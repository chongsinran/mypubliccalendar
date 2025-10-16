FROM node:18

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY src ./src
COPY public ./public

EXPOSE 5001

CMD [ "node", "src/index.js" ]
