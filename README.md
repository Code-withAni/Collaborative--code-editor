# Collaborative Code Editor

A professional-grade real-time collaborative coding platform designed for developers to code together in sync. Featuring a VS Code-inspired interface, real-time file synchronization, and secure room-based collaboration.

## 🚀 Features

- **Real-Time Collaboration**: Multi-user editing with live synchronization powered by Socket.io.
- **VS Code Experience**: Embedded Monaco Editor for a familiar and powerful coding environment.
- **File Management**: Integrated file tree sidebar with support for uploading entire directories.
- **Secure Authentication**: JWT-based authentication with administrative controls for room owners.
- **Dynamic UI**: Responsive, premium design built with Tailwind CSS, Framer Motion, and Radix UI.
- **State Management**: Robust data fetching and state handling using TanStack Query.

## 🛠️ Tech Stack

**Frontend:**
- React (Vite)
- Monaco Editor (@monaco-editor/react)
- Socket.io-client
- Tailwind CSS
- Framer Motion
- Lucide React (Icons)
- Radix UI (Primitives)

**Backend:**
- Node.js & Express
- Socket.io
- MongoDB (Mongoose)
- JWT (Authentication)
- Bcrypt.js (Security)

## 📦 Installation

### Prerequisites
- Node.js (v18+)
- MongoDB (Running locally or Atlas)

### 1. Clone the repository
```bash
git clone https://github.com/Code-withAni/Collaborative--code-editor.git
cd Collaborative--code-editor
```

### 2. Server Setup
```bash
cd server
npm install
```
Create a `.env` file in the `server` directory:
```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
```
Start the server:
```bash
npm run dev
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install
```
Start the frontend:
```bash
npm run dev
```

## 🤝 Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License
This project is licensed under the MIT License.

---

Built with ❤️ by Ani
