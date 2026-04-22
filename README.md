# Frontend Chatbot

?ng d?ng chatbot frontend du?c xây d?ng v?i React + Vite.

## Cài d?t

`ash
npm install
`

## C?u hình

1. T?o file .env trong thu m?c g?c và thêm OpenAI API key:

`env
VITE_OPENAI_API_KEY=your_openai_api_key_here
`

2. L?y API key t? [OpenAI Platform](https://platform.openai.com/api-keys)

## Ch?y ?ng d?ng

`ash
npm run dev
`

## Tính nang

- Qu?n lý tr? lý OpenAI (Assistants)
- T?o, ch?nh s?a, xóa assistants
- H? tr? các công c?: Code Interpreter, File Search
- Giao di?n admin d? qu?n lý h? th?ng

## API Endpoints

?ng d?ng g?i tr?c ti?p OpenAI API cho vi?c qu?n lý assistants:

- GET /v1/assistants - L?y danh sách assistants
- POST /v1/assistants - T?o assistant m?i
- POST /v1/assistants/{id} - C?p nh?t assistant
- DELETE /v1/assistants/{id} - Xóa assistant
