const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const connectDB = require("./config/db");
const userRoutes = require("./routes/userRoutes");
const chatRoutes = require("./routes/chatRoutes");
const messageRoutes = require("./routes/messageRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
require("colors");
const mongoose = require("mongoose");

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Middleware to parse JSON
app.use(express.json());

// Routes
app.use("/api/user", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/message", messageRoutes);

// Deployment setup
const __dirname1 = path.resolve();
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname1, "/frontend/build")));
  app.get("*", (req, res) =>
    res.sendFile(path.resolve(__dirname1, "frontend", "build", "index.html"))
  );
} else {
  app.get("/", (req, res) => {
    console.log("API root route accessed");
    res.send("API is running..");
  });
}

// Error handling middlewares
app.use(notFound);
app.use(errorHandler);

// Server setup
const PORT = process.env.PORT || 5000;

const server = app.listen(
  PORT,
  console.log(`Server running on PORT ${PORT}...`.yellow.bold)
);

// Socket.io setup
const io = require("socket.io")(server, {
  pingTimeout: 60000,
  cors: {
    origin: "http://localhost:3000",
  },
});

io.on("connection", (socket) => {
  console.log("Connected to socket.io");

  socket.on("setup", (userData) => {
    console.log("Setup Event Triggered:", userData);
    socket.join(userData._id);
    socket.emit("connected");
  });

  socket.on("join chat", (room) => {
    console.log(`User Joined Room: ${room}`);
    socket.join(room);
  });

  socket.on("typing", (room) => {
    console.log(`Typing event in Room: ${room}`);
    socket.in(room).emit("typing");
  });

  socket.on("stop typing", (room) => {
    console.log(`Stop Typing event in Room: ${room}`);
    socket.in(room).emit("stop typing");
  });

  socket.on("new message", (newMessageRecieved) => {
    console.log("New Message Received:", newMessageRecieved);

    const chat = newMessageRecieved.chat;
    if (!chat.users) {
      console.error("chat.users not defined");
      return;
    }

    chat.users.forEach((user) => {
      if (user._id === newMessageRecieved.sender._id) return;
      console.log(`Emitting message to User: ${user._id}`);
      socket.in(user._id).emit("message recieved", newMessageRecieved);
    });
  });

  socket.off("setup", (userData) => {
    console.log("USER DISCONNECTED:", userData);
    socket.leave(userData._id);
  });
});
