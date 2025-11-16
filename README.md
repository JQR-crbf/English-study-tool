# N5 English Study Tool

A comprehensive English study tool designed for N5 level learners, featuring translation and vocabulary review functionalities.

## 🚀 Features

### 🌐 Translation
- **Real-time Translation**: powered by Zhipu AI and SiliconFlow APIs
- **Multiple AI Models**: Support for different language models
- **Context-aware translations** for better accuracy

### 📚 Vocabulary Review
- **Smart Flashcards**: Interactive vocabulary learning system
- **Progress Tracking**: Monitor your learning progress
- **Review Scheduling**: Spaced repetition for better retention

### 💻 Tech Stack

#### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Modern UI components** with responsive design

#### Backend
- **Node.js** with Express.js
- **RESTful API** architecture
- **Environment-based configuration**

#### Database
- **SQLite** for data persistence
- **JSON-based local storage** for application data

## 🛠️ Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/JQR-crbf/English-study-tool.git
   cd English-study-tool
   ```

2. **Install dependencies**
   ```bash
   # Install frontend dependencies
   cd app
   npm install

   # Install backend dependencies
   cd ../server
   npm install
   ```

3. **Configure environment variables**
   ```bash
   # Copy the example environment file
   cp .env.example .env

   # Edit .env with your API keys
   # See Configuration section for details
   ```

4. **Start the application**
   ```bash
   # Start backend server
   cd server
   npm run dev

   # Start frontend development server
   cd ../app
   npm run dev
   ```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the `server` directory:

```env
# API Keys
ZHIPU_API_KEY=your_zhipu_api_key_here
SILICONFLOW_API_KEY=your_siliconflow_api_key_here

# Server Configuration
PORT=3001

# Model Configuration
MODEL_ZHIPU=glm-4.6
MODEL_SILICONFLOW=zai-org/GLM-4.6
```

### API Setup

1. **Zhipu AI**: Sign up at [Zhipu AI](https://open.bigmodel.cn/) to get your API key
2. **SiliconFlow**: Sign up at [SiliconFlow](https://siliconflow.cn/) to get your API key

## 📁 Project Structure

```
English-study-tool/
├── app/                 # React frontend application
│   ├── src/             # Source code
│   ├── public/          # Static assets
│   └── package.json     # Frontend dependencies
├── server/              # Node.js backend server
│   ├── src/             # Server source code
│   ├── .env             # Environment variables
│   └── package.json     # Backend dependencies
├── data/                # Database files
├── .gitignore           # Git ignore rules
└── README.md            # This file
```

## 🚀 Usage

### Translation Feature
1. Enter text you want to translate
2. Select your preferred AI model
3. Get real-time translations powered by advanced AI

### Vocabulary Review
1. Study flashcards with N5 level vocabulary
2. Track your progress and improvement
3. Use spaced repetition for optimal learning

## 🔒 Security

- **Environment Variables**: API keys are stored in `.env` files (excluded from Git)
- **No Hardcoded Secrets**: All sensitive data is managed through environment variables
- **Secure File Management**: Large binaries and sensitive files are excluded from version control

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 Support

If you have any questions or suggestions, please open an issue or contact the maintainers.

## 🙏 Acknowledgments

- [Zhipu AI](https://open.bigmodel.cn/) for AI translation services
- [SiliconFlow](https://siliconflow.cn/) for additional AI capabilities
- [Vite](https://vitejs.dev/) for the amazing build tool
- [React](https://reactjs.org/) for the fantastic UI library

---

**Built with ❤️ for N5 English learners**