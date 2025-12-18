# Elysia with Bun runtime

## Getting Started
To get started with this template, simply paste this command into your terminal:
```bash
$ docker build -t elysia-app .
$ docker run \
  --name elysia-test \
  -p 3005:3005 \
  elysia-app
```

## Development
To start the development server run:
```bash
bun start
```

Open http://localhost:3000/ with your browser to see the result.