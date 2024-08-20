# Yandex Cloud Uploader (and all s3)

## Getting started

### Env

#### Create and fill
```shell
cp .env.example .env
```

### Services

#### Sentry
```shell
docker run --rm sentry config generate-secret-key
```
```shell
docker-compose run --rm sentry upgrade
```

#### Up service
```shell
docker-compose --env-file .env -f docker-compose.yml  up -d
```

### Start server

#### Dev
```shell
pnpm run start:dev
```
#### Prod 
```shell
pnpm run build
```
```shell
pnpm run start:prod
```

## License
Copyright (c) 2024 T0R0NT0T0KY0  
Licensed under the MIT license.
