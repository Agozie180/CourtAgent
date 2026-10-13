# Deployments

`npm run deploy:sepolia` writes `sepolia.json` here with the deployed contract address,
chain id and deployment block. Commit that file so other developers can see the live address,
and copy the address into `NEXT_PUBLIC_REGISTRY_ADDRESS` in `.env.local`.
