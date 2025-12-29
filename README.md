# **🍅 PomoFocus Chrome Extension**

**PomoFocus** is a modern Chrome Extension designed to help you maintain high focus using the Pomodoro technique. Featuring a minimalist design, it allows you to manage your time effectively without interruptions.


## **✨ Key Features**

* **⏱️ Pomodoro Timer:** Standard cycle: 25m Focus \- 5m Short Break \- 15m Long Break.  
* **📝 Task Management:** Manage your to-do list and track detailed session history.  
* **🔊 Sound & Notifications:** Audio alerts and system notifications when the timer ends.  
* **🔒 Offline & Privacy-First:** All data is stored locally (chrome.storage.local); no user tracking.

## **🛠️ Tech Stack**

* **Core:** HTML5, CSS3 (Flexbox/Variables), JavaScript (Vanilla).  
* **Chrome APIs:**  
  * Manifest V3  
  * chrome.storage (Data persistence)  
  * chrome.alarms (Background timer logic)  
  * chrome.notifications (System alerts)

## **🚀 Installation Guide**

Since this is an open-source project, you can install it directly via Chrome Developer Mode:

1. **Clone** or **Download** this repository to your machine.  
   git clone \[https://github.com/ngocquynhpham/pomofocus.git\](https://github.com/ngocquynhpham/pomofocus.git)

2. Open Chrome and navigate to: chrome://extensions/  
3. Enable **Developer mode** (Toggle in the top-right corner).  
4. Click **Load unpacked**.  
5. Select the PomoFocus\_v1 folder you just downloaded.  
6. Pin the extension to your toolbar and start focusing\! 🍅

## **📂 Project Structure**

PomoFocus\_v1/  
├── manifest.json       \# Core Configuration (Manifest V3)  
├── background.js       \# Service Worker (Timer Logic & Alarms)  
├── popup.html          \# Main UI  
├── popup.js            \# UI Logic  
├── style.css           \# Design System & Styling  
└── icons/              \# App Icons

## **🤝 Contributing**

Contributions are welcome\! Please feel free to open an **Issue** if you find a bug or submit a **Pull Request** for new features.

## **📄 License**

*Made with ❤️ for productivity lovers.*
