# Home Test API

- [API Guidelines](https://confluence.build.ingka.ikea.com/display/DPOP/API+Guidelines)

## Local Dev

Since the application have a dependency on the Product Information API, we always need configure the secrets to access that api. Even locally.
The api expects the pi api secrets to be available in the `API_SECRETS` environment variable.

Our `./with-local-env.sh` script can handles reading the secrets from azure keyvault and setting `API_SECRETS`. But if the script is not used, the secrets needs to be set manually.

To read secrets from azure keyvault you need read access.
That access is handled manually in the Azure Portal [Key Vault - Access policies](https://portal.azure.com/#@OneIIG.onmicrosoft.com/resource/subscriptions/55646d09-865d-4a5f-bffc-28e299acda97/resourceGroups/rg-shared-nonprd/providers/Microsoft.KeyVault/vaults/kv-hometest-nonprd/access_policies)

```sh
# Install dependencies
yarn install

# Start the application and database
# Handles secret setup
yarn run dev

# Start only the database
# Does not handle secret setup
yarn run dev:db

# Start only the application
# Does not handle secret setup
yarn run dev:app
```

### Local testing

Running the tests requires both that the secrets are setup and that a database is running. The same `yarn run dev:db` as above is used to start the database.

The default test command does not handle the secret setup.

```sh
# Run tests
yarn run test
```

The `test:local` script does handles secrets setup.

```sh
# Run tests
# Handles secret setup
yarn run test:local
```

Automatically handling the secret setup makes `yarn run test:local` easy to try once, but annoying to rerun often during development. Therefor I recommend manually handling the secret setup and using `yarn run test`.

### Manual secret handling

This is exactly what the `./with-local-env.sh` script does.

```sh
# Login to azure
az login -o none

# Read the secret and set the `API_SECRETS` env variable
export API_SECRETS="$(az keyvault secret show --id 'https://kv-benodejs-dev.vault.azure.net/secrets/pi-api-dev/' --query value -o tsv)"

```

### Local build

```sh
# Build the application container
# No secrets required to build
docker build -t hometest-api .

# Start a local copy of the api, in containers
# Including a local database
# Does not handle secret setup
docker-compose up

# Same as docker-compose up
# But handles secret setup
yarn run compose
```

### Migrations

To format newly created migrations run the yarn script `yarn run format:sql` followed by the migraions file you want to format.
example: `yarn run format:sql -o migrations/{outputFile} migrations/{inputFile}`.

## HTTPS

The API does not handle TLS internally.

Therefore something else needs to handle TLS on behalf of the API, such as a gateway or reverse proxy. For TLS and other security reasons the API _should not_ run exposed directly to the public internet. Since the API is not publicly exposed, the TLS endpoint must run in the same private context as the API.

Azure App Service handles this for us.

## Deployment

Deployment procedures are documented in the [infrastructure/README.md](infrastructure/README.md).

## Dependencies

The full list of dependencies can be found by looking in the `package.json`.
This section contains a list of dependencies that stands out from the full dependencies list.

### Express

The API is built on the express framework. More information about express can be found here: https://expressjs.com/

### Express Open API validator

The express Open API validator works as a middleware to validate incoming requests agains the Open API specification located here: `../openapi/home-test-api.yaml`.

Read more about express Open API validator here: https://www.npmjs.com/package/express-openapi-validator#example-express-api-server

### Ajv

Ajv is a JSON Schema Validator.
Since the respones from the PI-API is json, we need some way of validating the data and then transform that data into an internal data model.
This is done in the `./src/mapper/product.ts`.

[Ajv](https://ajv.js.org/)

### PgFormat (deprecated)

pg-format was used as a first option to create dynamic SQL queries. When the project progressed and the sql queries became more complex, the decision was made to switch to Slonik (More information in the next section).
The dependecy is not removed since its still used in the test but should be phased out.

[pg-format](https://www.npmjs.com/package/pg-format)

### Slonik

Slonik is a library to create dynamic SQL queries which forces sql injection attack prevention. Should replace`pg-format` for all new code.

- [Slonik](https://github.com/gajus/slonik)
- [Article about Slonik](https://gajus.medium.com/stop-using-knex-js-and-earn-30-bf410349856c)
