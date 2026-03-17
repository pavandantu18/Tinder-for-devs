FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 3004
EXPOSE 50054
CMD ["node", "src/index.js"]
