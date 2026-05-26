FROM node:24-alpine

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY package*.json .
RUN npm ci \
    && npm cache clean --force

COPY . .

EXPOSE 9000
CMD ["npm", "run", "start-docker"]
