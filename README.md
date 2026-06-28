# Blankup

Web custom T-shirt/hoodie/polo: nguoi dung nhap prompt tieng Viet hoac tai anh tham khao, AI tao artwork, sau do artwork duoc xem tren ao 3D va dat hang COD.

## Da Lam Duoc

- Trang chu, dang nhap, giao dien studio, admin va gallery thiet ke.
- Tao artwork AI tu prompt hoac anh tham khao qua API Cloudflare Workers AI.
- AI prompt enhancer: dich va lam ro prompt tieng Viet sang tieng Anh, uu tien giu dung chu the, dia danh, mau sac va chi tiet nguoi dung yeu cau.
- Luu artwork, gallery va don hang qua Express + SQL Server; khi SQL Server khong san sang, backend van chay o demo mode.
- Chon kieu ao (T-shirt, Hoodie, Polo), mau ao, size, so luong, dat hang COD va tai artwork.
- Viewer ao 3D bang Three.js: keo chuot de xoay, nut `Truoc/Sau`, va artwork duoc chieu thanh decal tren be mat model ao.
- Model dang dung: `frontend/assets/models/tshirt-web.glb`, `frontend/assets/models/hoodie-web.glb`, `frontend/assets/models/polo-web.glb`.

## Cau Truc Chinh

```text
frontend/
  studio.html                 Trang tao design va preview ao
  js/studio.js                Xu ly UI, goi API, artwork va dat hang
  js/tshirt-360.js            Three.js, GLTFLoader, OrbitControls, decal artwork
  css/studio.css              Giao dien studio va viewer
  assets/models/tshirt-web.glb Model T-shirt 3D dung trong browser
  assets/models/hoodie-web.glb Model hoodie 3D dung trong browser
  assets/models/polo-web.glb   Model polo 3D dung trong browser

backend/
  server.js                   Express server, static files va API routes
  routes/ai-design.js         Tao artwork AI, prompt enhancer, gallery
  routes/orders.js            API don hang
  routes/auth.js              API xac thuc
  db.js                       Ket noi va khoi tao SQL Server
  create-blankup-db.sql       Script tao database BlankupDB
  run-localhost.ps1           Script chay localhost
  .env.example                Mau bien moi truong
```

## Yeu Cau

- Node.js 18 tro len.
- SQL Server Express la tuy chon cho demo, can co neu muon luu DB that.
- Tai khoan Cloudflare va Workers AI API token de tao artwork AI that.

## Cai Dat Va Chay

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

Mo `backend/.env` va dien thong tin Cloudflare, SQL Server cua may. Khong commit file nay.

Chay web tren Windows PowerShell:

```powershell
cd backend
Set-ExecutionPolicy -Scope Process Bypass
.\run-localhost.ps1
```

Mo: `http://localhost:3000/studio.html`

Neu chay bang VS Code, mo Terminal (`Ctrl + backtick`) va dung cac lenh tren. Khong dung Live Server, vi trang studio can Express backend de goi AI va database.

## Clone Va Test Nhanh

Nguoi lam tiep co the test UI, upload anh, gallery va viewer ao 3D ma khong can token AI hay SQL Server.

```powershell
git clone <URL_REPOSITORY>
cd EXE_Blankup\backend
npm install
Set-ExecutionPolicy -Scope Process Bypass
.\run-localhost.ps1
```

Mo `http://localhost:3000/studio.html`. Khi khong co `backend/.env`, backend tu dong dung mock artwork va file-backed demo mode. Muon tao artwork AI that thi copy `.env.example` thanh `.env` va dien Cloudflare token rieng.

## Day Len Git

```powershell
git status
git add .
git commit -m "Add AI t-shirt studio and 3D viewer"
git branch -M main
git remote add origin <URL_REPOSITORY>
git push -u origin main
```

Kiem tra `git status` truoc khi push: khong duoc co `backend/.env`, `backend/node_modules/`, `backend/uploads/`, hoac model trung gian `tshirt.glb` va `tshirt-optimized.glb`. `.gitignore` da bo qua cac file nay.

## Bien Moi Truong Quan Trong

```env
PORT=3000
AI_PROVIDER_PRIORITY=openai,cloudflare
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_IMAGE_MODEL=@cf/black-forest-labs/flux-1-schnell
CLOUDFLARE_PROMPT_MODEL=@cf/meta/llama-3.1-8b-instruct
ENABLE_AI_PROMPT_ENHANCER=true

OPENAI_API_KEY=...
OPENAI_IMAGE_MODEL=gpt-image-2
OPENAI_IMAGE_SIZE=1024x1024
OPENAI_IMAGE_QUALITY=low
OPENAI_IMAGE_BACKGROUND=auto
OPENAI_IMAGE_OUTPUT_FORMAT=png
ENABLE_AI_PRODUCT_MOCKUP=false
PAYMENT_WEBHOOK_SECRET=...

SQL_SERVER=.\SQLEXPRESS
SQL_DATABASE=BlankupDB
SQL_USER=sa
SQL_PASSWORD=...
```

Xem day du cac bien trong `backend/.env.example`.

## Luong AI Va Preview 3D

1. `studio.js` gui prompt/anh len `/api/ai-design`.
2. `ai-design.js` dung prompt enhancer de chuyen prompt tieng Viet thanh prompt anh tieng Anh trung thanh voi yeu cau.
3. Workers AI sinh artwork va luu vao `backend/uploads/`.
4. `tshirt-360.js` tai model GLB theo kieu ao dang chon, dung `DecalGeometry` de chieu artwork len mat truoc ao.
5. Khach keo chuot tren viewer de xoay 360 do; nut `Truoc/Sau` dat lai goc camera.

## Luu Y Khi Phat Trien Tiep

- Artwork AI co the khac chi tiet so voi prompt, dac biet voi meme/nhan vat co ten. Prompt enhancer da giam sai lech, nhung model anh van co do ngau nhien.
- De chat luong artwork va image+idea tot nhat, cau hinh `OPENAI_API_KEY`; backend se uu tien OpenAI image edit/generation roi moi fallback sang Cloudflare. Neu chi co Cloudflare, luong upload anh khong doc duoc pixel anh that ma chi dung y tuong text lam fallback.
- De tu xac nhan QR chuyen khoan, can ket noi provider co webhook giao dich ngan hang va tro callback ve `/api/orders/payment-webhook` kem header `x-webhook-secret` hoac `Authorization: Bearer ...` trung voi `PAYMENT_WEBHOOK_SECRET`.
- Decal hien tai duoc chieu vao phan than truoc cua tung model. Neu thay model ao khac, can kiem tra lai vi tri, kich thuoc va huong decal trong `frontend/js/tshirt-360.js`.
- Model GLB dang dung da duoc nen Meshopt. `GLTFLoader` can `MeshoptDecoder`; khong xoa doan import/cau hinh nay.
- Model goc `tshirt.glb` va `tshirt-optimized.glb` la file trung gian, khong can dua len Git. Chi can cac model web dang dung trong `frontend/assets/models/`.
- Frontend co fallback 2D neu GLB khong tai duoc, nhung luong chinh la viewer 3D.
- Can kiem tra license cua model ao truoc khi deploy/cong khai san pham.

## Kiem Tra Nhanh

```powershell
cd backend
node --check server.js
node --check routes/ai-design.js
```

Sau khi sua frontend, tai lai bang `Ctrl + F5` de tranh cache script/module cu.
