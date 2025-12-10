# Dockerfile
FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

RUN addgroup -S nodegrp \
    && adduser -S nodeuser -G nodegrp \
    && chown -R nodeuser:nodegrp /usr/src/app

USER nodeuser

ENV NODE_ENV=development
EXPOSE 3000

CMD ["npm", "run", "dev"]
