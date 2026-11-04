FROM node:24-alpine
RUN apk add --no-cache mariadb-client

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .
RUN mkdir -p /app/podatki/datoteke /app/backup && chown -R node:node /app/podatki /app/backup
USER node

EXPOSE 3000

CMD ["npm", "start"]
