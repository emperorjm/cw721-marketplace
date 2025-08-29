#![cfg(test)]
use cosmwasm_std::{Addr, Coin, Uint128};
use cw_multi_test::Executor;

use cw20::Expiration;
use cw721::OwnerOfResponse;
use cw721_base::{
    msg::ExecuteMsg as Cw721ExecuteMsg, msg::QueryMsg as Cw721QueryMsg, Extension, MintMsg,
};

use crate::integration_tests::util::{
    bank_query, create_cw721, create_swap, mint_native, mock_app,
};
use crate::msg::{ExecuteMsg, FinishSwapForMsg, SwapMsg};
use crate::state::SwapType;

static DENOM: &str = "uxion";

// Test Crossmint purchasing on behalf of a user
#[test]
fn test_crossmint_purchase_for_user() {
    let mut app = mock_app();

    // Swap owner deploys
    let swap_admin = Addr::unchecked("swap_deployer");
    // nft_owner owns the NFT
    let nft_owner = Addr::unchecked("nft_owner");
    // crossmint is the payment provider
    let crossmint = Addr::unchecked("crossmint_wallet");
    // end_user is the recipient of the NFT
    let end_user = Addr::unchecked("end_user");

    // nft_owner creates the cw721
    let nft = create_cw721(&mut app, &nft_owner);

    // swap_admin creates the swap contract
    let swap = create_swap(&mut app, &swap_admin);
    let swap_inst = swap.clone();

    // Mint native to Crossmint (who will pay)
    mint_native(
        &mut app,
        crossmint.to_string(),
        Uint128::from(10000000000000000000_u128), // 10 XION as uxion
    );

    // nft_owner mints a cw721
    let token_id = "crossmint_test_nft".to_string();
    let token_uri = "https://example.com/nft".to_string();
    let mint_msg = Cw721ExecuteMsg::Mint(MintMsg::<Extension> {
        token_id: token_id.clone(),
        owner: nft_owner.to_string(),
        token_uri: Some(token_uri.clone()),
        extension: None,
    });
    let _res = app
        .execute_contract(nft_owner.clone(), nft.clone(), &mint_msg, &[])
        .unwrap();

    // Create a SwapMsg for creating a sale listing
    let creation_msg = SwapMsg {
        id: "crossmint_swap".to_string(),
        cw721: nft.clone(),
        payment_token: None,
        token_id: token_id.clone(),
        expires: Expiration::from(cw20::Expiration::AtHeight(384798573487439743)),
        price: Uint128::from(1000000000000000000_u128), // 1 XION as uxion
        swap_type: SwapType::Sale,
    };

    // Seller (nft_owner) must approve the swap contract to spend their NFT
    let nft_approve_msg = Cw721ExecuteMsg::Approve::<Extension> {
        spender: swap.to_string(),
        token_id: token_id.clone(),
        expires: None,
    };
    let _res = app
        .execute_contract(nft_owner.clone(), nft.clone(), &nft_approve_msg, &[])
        .unwrap();

    // NFT seller (nft_owner) creates a swap
    let _res = app
        .execute_contract(
            nft_owner.clone(),
            swap_inst.clone(),
            &ExecuteMsg::Create(creation_msg.clone()),
            &[],
        )
        .unwrap();

    // Query initial NFT ownership
    let owner_query = Cw721QueryMsg::OwnerOf {
        token_id: token_id.clone(),
        include_expired: None,
    };
    let owner_response: OwnerOfResponse = app
        .wrap()
        .query_wasm_smart(&nft, &owner_query)
        .unwrap();
    assert_eq!(owner_response.owner, nft_owner.to_string());

    // Query initial balances
    let nft_owner_balance_before = bank_query(&app, &nft_owner);
    let crossmint_balance_before = bank_query(&app, &crossmint);
    let end_user_balance_before = bank_query(&app, &end_user);

    // Crossmint purchases the NFT on behalf of end_user
    let finish_for_msg = FinishSwapForMsg {
        id: creation_msg.id.clone(),
        recipient: end_user.clone(),
    };

    let _res = app
        .execute_contract(
            crossmint.clone(),
            swap_inst.clone(),
            &ExecuteMsg::FinishFor(finish_for_msg),
            &[Coin {
                denom: String::from(DENOM),
                amount: Uint128::from(1000000000000000000_u128), // 1 XION
            }],
        )
        .unwrap();

    // Verify NFT ownership transferred to end_user (not Crossmint)
    let owner_response: OwnerOfResponse = app
        .wrap()
        .query_wasm_smart(&nft, &owner_query)
        .unwrap();
    assert_eq!(owner_response.owner, end_user.to_string());

    // Verify balances
    let nft_owner_balance_after = bank_query(&app, &nft_owner);
    let crossmint_balance_after = bank_query(&app, &crossmint);
    let end_user_balance_after = bank_query(&app, &end_user);

    // NFT owner should have received payment
    assert_eq!(
        nft_owner_balance_after.amount,
        nft_owner_balance_before.amount + Uint128::from(1000000000000000000_u128)
    );

    // Crossmint should have paid
    assert_eq!(
        crossmint_balance_after.amount,
        crossmint_balance_before.amount - Uint128::from(1000000000000000000_u128)
    );

    // End user balance should remain unchanged (they didn't pay)
    assert_eq!(end_user_balance_after.amount, end_user_balance_before.amount);
}

// Test that regular finish still works (backward compatibility)
#[test]
fn test_backward_compatibility_regular_finish() {
    let mut app = mock_app();

    // Swap owner deploys
    let swap_admin = Addr::unchecked("swap_deployer");
    // nft_owner owns the NFT
    let nft_owner = Addr::unchecked("nft_owner");
    // buyer purchases the NFT
    let buyer = Addr::unchecked("buyer");

    // nft_owner creates the cw721
    let nft = create_cw721(&mut app, &nft_owner);

    // swap_admin creates the swap contract
    let swap = create_swap(&mut app, &swap_admin);
    let swap_inst = swap.clone();

    // Mint native to buyer
    mint_native(
        &mut app,
        buyer.to_string(),
        Uint128::from(10000000000000000000_u128), // 10 XION as uxion
    );

    // nft_owner mints a cw721
    let token_id = "backward_compat_nft".to_string();
    let token_uri = "https://example.com/nft".to_string();
    let mint_msg = Cw721ExecuteMsg::Mint(MintMsg::<Extension> {
        token_id: token_id.clone(),
        owner: nft_owner.to_string(),
        token_uri: Some(token_uri.clone()),
        extension: None,
    });
    let _res = app
        .execute_contract(nft_owner.clone(), nft.clone(), &mint_msg, &[])
        .unwrap();

    // Create a SwapMsg for creating a sale listing
    let creation_msg = SwapMsg {
        id: "backward_swap".to_string(),
        cw721: nft.clone(),
        payment_token: None,
        token_id: token_id.clone(),
        expires: Expiration::from(cw20::Expiration::AtHeight(384798573487439743)),
        price: Uint128::from(1000000000000000000_u128), // 1 XION as uxion
        swap_type: SwapType::Sale,
    };

    // Seller (nft_owner) must approve the swap contract to spend their NFT
    let nft_approve_msg = Cw721ExecuteMsg::Approve::<Extension> {
        spender: swap.to_string(),
        token_id: token_id.clone(),
        expires: None,
    };
    let _res = app
        .execute_contract(nft_owner.clone(), nft.clone(), &nft_approve_msg, &[])
        .unwrap();

    // NFT seller (nft_owner) creates a swap
    let _res = app
        .execute_contract(
            nft_owner.clone(),
            swap_inst.clone(),
            &ExecuteMsg::Create(creation_msg.clone()),
            &[],
        )
        .unwrap();

    // Regular buyer purchases NFT using original Finish message
    let finish_msg = crate::msg::FinishSwapMsg {
        id: creation_msg.id.clone(),
    };

    let _res = app
        .execute_contract(
            buyer.clone(),
            swap_inst.clone(),
            &ExecuteMsg::Finish(finish_msg),
            &[Coin {
                denom: String::from(DENOM),
                amount: Uint128::from(1000000000000000000_u128), // 1 XION
            }],
        )
        .unwrap();

    // Verify NFT ownership transferred to buyer (using regular finish)
    let owner_query = Cw721QueryMsg::OwnerOf {
        token_id: token_id.clone(),
        include_expired: None,
    };
    let owner_response: OwnerOfResponse = app
        .wrap()
        .query_wasm_smart(&nft, &owner_query)
        .unwrap();
    assert_eq!(owner_response.owner, buyer.to_string());
}