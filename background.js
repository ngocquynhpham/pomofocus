/*
  PomoFocus Background Service Worker - Phase 2
  Handles Timer Logic, Alarms, Notifications, and Storage State
*/
// Add at top
let offscreenDocumentCreated = false;

// Helper function to ensure offscreen document exists
async function ensureOffscreenDocument() {
  if (offscreenDocumentCreated) return;
  
  try {
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    
    if (existingContexts.length > 0) {
      offscreenDocumentCreated = true;
      return;
    }
    
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Play alarm sound when timer finishes'
    });
    
    offscreenDocumentCreated = true;
    console.log('✅ Offscreen document created');
  } catch (error) {
    console.error('Error creating offscreen document:', error);
  }
}
// --- 1. INITIALIZATION ---
chrome.runtime.onInstalled.addListener(() => {
  const defaultSettings = {
    focusTime: 25,
    shortBreak: 5,
    longBreak: 15,
    longBreakInterval: 4,
    soundEnabled: true
  };

  // Khởi tạo trạng thái mặc định nếu chưa có
  chrome.storage.local.get(['settings', 'currentTask', 'history'], (result) => {
    if (!result.settings) chrome.storage.local.set({ settings: defaultSettings });
    if (!result.history) chrome.storage.local.set({ history: [] });
    // currentTask để null nghĩa là Idle
  });
  
  console.log("PomoFocus installed & initialized.");
});

// --- 2. MESSAGE HANDLING ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "START_TIMER") {
    startTimer(request.payload);
  } else if (request.action === "PAUSE_TIMER") {
    pauseTimer();
  } else if (request.action === "RESUME_TIMER") {
    resumeTimer();
  } else if (request.action === "STOP_TIMER") { // Done Task
    stopTimer();
  } else if (request.action === "GET_STATUS") {
    // Popup yêu cầu lấy trạng thái hiện tại để render
    sendResponse({ status: "OK" }); // Popup sẽ tự đọc từ storage
  }
});

// --- 3. CORE TIMER LOGIC ---

async function startTimer(payload) {
  // payload: { taskName, duration (minutes), isBreak (boolean) }
  const now = Date.now();
  const durationInMs = payload.duration * 60 * 1000;
  const targetTime = now + durationInMs;

  // Cập nhật trạng thái Current Task
  const currentTask = {
    name: payload.taskName,
    status: "RUNNING", // RUNNING, PAUSED
    startTime: now, // Thời điểm bắt đầu phiên này
    targetTime: targetTime,
    durationOriginal: payload.duration,
    isBreak: payload.isBreak || false,
    sessionIndex: payload.sessionIndex || 1 // Mặc định là phiên 1
  };
  
  // Nếu đây là Task mới (không phải Break), lưu startTime gốc để tính tổng thời gian sau này
  if (!payload.isBreak && !payload.originalStartTime) {
    currentTask.originalStartTime = now; 
  } else if (payload.originalStartTime) {
    currentTask.originalStartTime = payload.originalStartTime;
  }

  await chrome.storage.local.set({ currentTask });
  
  // Tạo Alarm báo thức
  chrome.alarms.create("pomoTimer", { when: targetTime });
  
  console.log(`Timer Started: ${payload.taskName} until ${new Date(targetTime).toLocaleTimeString()}`);
}

async function pauseTimer() {
  const data = await chrome.storage.local.get(['currentTask']);
  if (data.currentTask && data.currentTask.status === "RUNNING") {
    // Tính thời gian còn lại
    const now = Date.now();
    const timeLeftMs = data.currentTask.targetTime - now;
    
    // Cập nhật trạng thái
    const updatedTask = {
      ...data.currentTask,
      status: "PAUSED",
      timeLeftMs: timeLeftMs // Lưu lại để resume
    };
    
    await chrome.storage.local.set({ currentTask: updatedTask });
    chrome.alarms.clear("pomoTimer");
    console.log("Timer Paused");
  }
}

async function resumeTimer() {
  const data = await chrome.storage.local.get(['currentTask']);
  if (data.currentTask && data.currentTask.status === "PAUSED") {
    const now = Date.now();
    const targetTime = now + data.currentTask.timeLeftMs;
    
    const updatedTask = {
      ...data.currentTask,
      status: "RUNNING",
      targetTime: targetTime,
      startTime: now // Reset start time của đoạn này
    };
    
    await chrome.storage.local.set({ currentTask: updatedTask });
    chrome.alarms.create("pomoTimer", { when: targetTime });
    console.log("Timer Resumed");
  }
}

async function stopTimer() {
  // Done Task -> Lưu vào History
  const data = await chrome.storage.local.get(['currentTask', 'history']);
  const task = data.currentTask;

  if (task && !task.isBreak) {
    const now = Date.now();
    const totalDurationMs = now - task.originalStartTime;
    const totalMinutes = Math.round(totalDurationMs / 60000); // Làm tròn phút

    const historyItem = {
      id: Date.now().toString(), // Simple ID
      name: task.name,
      endTime: now,
      totalDuration: totalMinutes > 0 ? totalMinutes : 1, // Tối thiểu 1 phút
      sessionsCount: task.sessionIndex // Tạm tính số phiên hiện tại
    };

    const newHistory = [historyItem, ...(data.history || [])];
    await chrome.storage.local.set({ history: newHistory });
  }

  // Clear Task
  await chrome.storage.local.remove(['currentTask']);
  chrome.alarms.clear("pomoTimer");
  console.log("Timer Stopped & Saved");
}

// --- 4. ALARM HANDLING (HẾT GIỜ) ---
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "pomoTimer") {
    const data = await chrome.storage.local.get(['currentTask', 'settings']);
    const task = data.currentTask;
    
    if (!task) return;

    console.log('⏰ Timer finished:', {
      name: task.name,
      isBreak: task.isBreak,
      sessionIndex: task.sessionIndex
    });

    // Đổi status sang FINISHED
    task.status = "FINISHED";
    await chrome.storage.local.set({ currentTask: task });

    // Thông báo
    const settings = data.settings || { soundEnabled: true };
    const notifMessage = task.isBreak 
      ? `Hết giờ nghỉ! Bắt đầu session ${task.sessionIndex + 1}?`
      : `Hoàn thành session ${task.sessionIndex}! Nghỉ ngơi nhé!`;
    
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "PomoFocus",
      message: notifMessage,
      priority: 2,
      requireInteraction: true, 
      silent: true // Tắt system sound, dùng custom sound
    });

    // Phát custom sound qua offscreen document
    if (settings.soundEnabled) {
      await ensureOffscreenDocument();
      chrome.runtime.sendMessage({ 
        action: "PLAY_SOUND" 
      }).catch(err => {
        console.error('Failed to play sound:', err);
      });
    }
  }
});