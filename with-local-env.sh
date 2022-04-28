#!/usr/bin/env sh

# Login unless explicitly skipped
if [ "$SKIP_AZ_LOGIN" != 'true' ]; then
  az login -o none
fi

# Set env
export DB_CONNECTION_STRING="postgresql://postgres:example@127.0.0.1:5432/postgres"
export API_SECRETS="$(az keyvault secret show --id 'https://kv-benodejs-dev.vault.azure.net/secrets/api-dev/' --query value -o tsv)"

# Run passed command
echo "$*"
eval "$*"
