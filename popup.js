/* PomoFocus Popup Logic - Phase 4.5 (PiP Fix)
   - Fix Double-flip bug in Next Phase transition
   - Trust Background state for isBreak and sessionIndex
   - Added valid notification sound
   - Improved PiP Logic
*/


document.addEventListener('DOMContentLoaded', () => {
  // --- 1. DOM ELEMENTS ---
  const tabs = document.querySelectorAll('.nav-item');
  const tabPanes = document.querySelectorAll('.tab-pane');
  
  // Timer Elements
  const taskInput = document.getElementById('task-input');
  const charCounter = document.getElementById('char-counter');
  const idleSection = document.getElementById('task-input-section');
  const runningSection = document.getElementById('current-task-display');
  const taskNameDisplay = document.getElementById('task-name-display');
  
  const timeDisplay = document.getElementById('time-display');
  const statusDisplay = document.getElementById('status-display');
  const timerRing = document.getElementById('timer-ring');
  
  // Progress Dots
  const dots = [
      document.getElementById('dot-1'), document.getElementById('dot-2'),
      document.getElementById('dot-3'), document.getElementById('dot-4')
  ];
  
  // Buttons
  const btnStart = document.getElementById('btn-start');
  const btnPause = document.getElementById('btn-pause');
  const btnDone = document.getElementById('btn-done');
  const runningControls = document.getElementById('running-controls');
  const btnPip = document.getElementById('btn-pip');

  // Settings & History
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const taskListContainer = document.getElementById('tasks-list-container');
  const btnClearHistory = document.getElementById('btn-clear-history');

  // --- 2. TAB SWITCHING ---
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Kiểm tra nếu đang có task đang chạy
      chrome.storage.local.get(['currentTask'], (data) => {
        const task = data.currentTask;
        
        // Chặn chuyển sang Settings nếu timer đang chạy hoặc pause
        if (tab.getAttribute('data-tab') === 'settings' && task && task.status !== "FINISHED") {
          alert("⚠️ Không thể thay đổi cài đặt khi timer đang chạy! Vui lòng hoàn thành hoặc dừng task.");
          return;
        }
        
        tabs.forEach(t => t.classList.remove('active'));
        tabPanes.forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const targetPane = document.getElementById(`tab-${tab.getAttribute('data-tab')}`);
        if (targetPane) targetPane.classList.add('active');
        if (tab.getAttribute('data-tab') === 'tasks') renderHistory();
        if (tab.getAttribute('data-tab') === 'settings') loadSettings();
      });
    });
  });

  // --- 3. UI UPDATE LOOP ---
  let uiInterval;
  let pipWindow = null; 

  function updateUI() {
    chrome.storage.local.get(['currentTask', 'settings'], (data) => {
      const task = data.currentTask;
      const settings = data.settings || { focusTime: 25 };
      if (document.visibilityState === 'visible') updateView(document, task, settings); 
      if (pipWindow && !pipWindow.closed) updateView(pipWindow.document, task, settings);
    });
  }
  
  function updateView(doc, task, settings) {
    const tInputSection = doc.getElementById('task-input-section');
    const tRunningSection = doc.getElementById('current-task-display');
    const tStartBtn = doc.getElementById('btn-start');
    const tRunningControls = doc.getElementById('running-controls');
    
    const tTimeDisplay = doc.getElementById('time-display');
    const tStatusDisplay = doc.getElementById('status-display');
    const tTaskNameDisplay = doc.getElementById('task-name-display');
    const tTimerRing = doc.getElementById('timer-ring');
    const tBtnPause = doc.getElementById('btn-pause');
    
    const tDots = [
        doc.getElementById('dot-1'), doc.getElementById('dot-2'), 
        doc.getElementById('dot-3'), doc.getElementById('dot-4')
    ];

    if (!task) {
      // IDLE STATE - FIX: Luôn hiển thị thời gian từ settings
      if(tInputSection) tInputSection.classList.remove('hidden');
      if(tRunningSection) tRunningSection.classList.add('hidden');
      if(tStartBtn) tStartBtn.style.display = 'block';
      if(tRunningControls) tRunningControls.style.display = 'none';
      
      // FIX 1: Hiển thị ngay thời gian từ settings, không cần kiểm tra
      const focusTime = settings.focusTime;
      if(tTimeDisplay) {
        tTimeDisplay.innerText = `${focusTime}:00`;
      }
      
      if(tStatusDisplay) { 
        tStatusDisplay.innerText = "READY"; 
        tStatusDisplay.style.color = "var(--color-text-secondary)"; 
      }
      if(tTimerRing) { 
        tTimerRing.style.strokeDashoffset = 0; 
        tTimerRing.style.stroke = "var(--color-focus)"; 
      }
      tDots.forEach(d => { if(d) d.className = 'dot'; });

    } else {
      // ACTIVE STATES
      if(tInputSection) tInputSection.classList.add('hidden');
      if(tRunningSection) tRunningSection.classList.remove('hidden');
      if(tTaskNameDisplay) tTaskNameDisplay.innerText = task.name;
      if(tStartBtn) tStartBtn.style.display = 'none';
      if(tRunningControls) { tRunningControls.classList.remove('hidden'); tRunningControls.style.display = 'flex'; }

      // Update Dots
      const currentSessionIdx = ((task.sessionIndex - 1) % 4); 
      tDots.forEach((d, idx) => {
          if(!d) return;
          d.className = 'dot'; 
          if (idx < currentSessionIdx) d.classList.add('completed'); 
          if (idx === currentSessionIdx) d.classList.add('active'); 
      });

      let timeLeft = 0;
      let totalDurationMs = task.durationOriginal * 60 * 1000;
      
      if (task.status === "RUNNING") {
        timeLeft = task.targetTime - Date.now();
        
        console.log('⏰ Timer running:', {
          isBreak: task.isBreak,
          sessionIndex: task.sessionIndex,
          timeLeft: Math.floor(timeLeft / 1000) + 's'
        });
        
        if(tStatusDisplay) {
           tStatusDisplay.innerText = task.isBreak ? "BREAK TIME" : `FOCUS`;
           tStatusDisplay.style.color = task.isBreak ? "var(--color-success)" : "var(--color-focus)";
        }
        if(tBtnPause) tBtnPause.innerText = "PAUSE";
      } else if (task.status === "PAUSED") {
        timeLeft = task.timeLeftMs;
        if(tStatusDisplay) { tStatusDisplay.innerText = "PAUSED"; tStatusDisplay.style.color = "var(--color-text-secondary)"; }
        if(tBtnPause) tBtnPause.innerText = "RESUME";
      } else if (task.status === "FINISHED") {
        timeLeft = 0;
        if(tStatusDisplay) {
          tStatusDisplay.innerText = task.isBreak ? "BREAK DONE" : "SESSION DONE";
        }
        if(tBtnPause) {
          tBtnPause.innerText = task.isBreak ? "NEXT SESSION" : "START BREAK";
        }
      }

      if (timeLeft < 0) timeLeft = 0;
      const totalSeconds = Math.ceil(timeLeft / 1000);
      const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
      const s = (totalSeconds % 60).toString().padStart(2, '0');
      if(tTimeDisplay) tTimeDisplay.innerText = `${m}:${s}`;
      
      const progress = 1 - (timeLeft / totalDurationMs);
      const circumference = 660; 
      const offset = circumference * progress;
      if(tTimerRing) {
          tTimerRing.style.strokeDashoffset = offset;
          tTimerRing.style.stroke = task.isBreak ? "var(--color-success)" : "var(--color-focus)";
      }
    }
  }

  // FIX 2: Load UI ngay lập tức khi mở popup
  updateUI();
  if (uiInterval) clearInterval(uiInterval);
  uiInterval = setInterval(updateUI, 1000);
  
  // --- CHARACTER COUNTER ---
  taskInput.addEventListener('input', (e) => {
    const currentLength = taskInput.value.length;
    const maxLength = 50;
    
    charCounter.innerText = `${currentLength}/${maxLength}`;
    
    if (currentLength > maxLength) {
      charCounter.style.color = '#ff4444'; // Đỏ
      charCounter.style.fontWeight = 'bold';
      alert('⚠️ Tên công việc không được vượt quá 50 ký tự! Vui lòng rút ngắn lại.');
      taskInput.focus();
    } else if (currentLength === maxLength) {
      charCounter.style.color = '#ff4444'; // Đỏ
      charCounter.style.fontWeight = 'bold';
    } else if (currentLength >= maxLength * 0.8) {
      charCounter.style.color = '#ff9800'; // Cam
      charCounter.style.fontWeight = 'normal';
    } else {
      charCounter.style.color = '#888888'; // Xám
      charCounter.style.fontWeight = 'normal';
    }
  });

  // Kiểm tra khi paste text
  taskInput.addEventListener('paste', (e) => {
    setTimeout(() => {
      const currentLength = taskInput.value.length;
      if (currentLength > 50) {
        charCounter.innerText = `${currentLength}/50`;
        charCounter.style.color = '#ff4444';
        charCounter.style.fontWeight = 'bold';
        alert('⚠️ Tên công việc không được vượt quá 50 ký tự! Vui lòng rút ngắn lại.');
        taskInput.focus();
      }
    }, 10);
  });

  // --- 4. HANDLERS ---
  
  function handleStart(taskName) {
    if (!taskName) { 
      alert("❌ Hãy nhập tên công việc!"); 
      taskInput.focus();
      return; 
    }
    if (taskName.length > 50) { 
      alert("❌ Tên công việc không được quá 50 ký tự!"); 
      taskInput.focus();
      return; 
    }
    chrome.storage.local.get(['settings'], (data) => {
      const settings = data.settings || { focusTime: 25 };
      chrome.runtime.sendMessage({ 
        action: "START_TIMER", 
        payload: { taskName, duration: settings.focusTime, isBreak: false, sessionIndex: 1 } 
      });
      setTimeout(updateUI, 100);
    });
  }

  function handlePauseResume(btnText) {
    if (btnText === "PAUSE") {
       chrome.runtime.sendMessage({ action: "PAUSE_TIMER" });
    } else if (btnText === "RESUME") {
       chrome.runtime.sendMessage({ action: "RESUME_TIMER" });
    } else if (btnText === "NEXT SESSION" || btnText === "START BREAK") {
       // DỪNG ÂM THANH TRƯỚC KHI CHUYỂN PHASE
       chrome.runtime.sendMessage({ action: "STOP_SOUND" });
       
       chrome.storage.local.get(['currentTask', 'settings'], (data) => {
          const task = data.currentTask;
          const settings = data.settings || { focusTime: 25, shortBreak: 5, longBreak: 15, longBreakInterval: 4 };
          
          console.log('🔍 Current task:', {
            name: task.name,
            sessionIndex: task.sessionIndex,
            isBreak: task.isBreak,
            buttonText: btnText
          });
          
          // Đảo ngược isBreak cho phase tiếp theo
          const isNextBreak = !task.isBreak;
          const nextSessionIndex = isNextBreak ? task.sessionIndex : task.sessionIndex + 1;
          
          let nextDuration;
          if (isNextBreak) {
              if (task.sessionIndex % settings.longBreakInterval === 0) {
                  nextDuration = settings.longBreak;
                  console.log(`🎉 Long Break ${nextDuration}min sau session ${task.sessionIndex}!`);
              } else {
                  nextDuration = settings.shortBreak;
                  console.log(`☕ Short Break ${nextDuration}min sau session ${task.sessionIndex}`);
              }
          } else {
              nextDuration = settings.focusTime;
              console.log(`🍅 Bắt đầu Focus session ${nextSessionIndex} (${nextDuration}min)`);
          }
          
          console.log('📤 Sending START_TIMER:', {
            taskName: task.name,
            duration: nextDuration,
            isBreak: isNextBreak,
            sessionIndex: nextSessionIndex
          });
          
          chrome.runtime.sendMessage({ 
             action: "START_TIMER", 
             payload: { 
               taskName: task.name, 
               duration: nextDuration, 
               isBreak: isNextBreak,
               sessionIndex: nextSessionIndex,
               originalStartTime: task.originalStartTime 
             } 
          });
          setTimeout(updateUI, 100);
       });
    }
 }

 btnStart.addEventListener('click', () => handleStart(taskInput.value.trim()));
 btnPause.addEventListener('click', () => handlePauseResume(btnPause.innerText));
 btnDone.addEventListener('click', handleStop);

 function handleStop() {
  chrome.runtime.sendMessage({ action: "STOP_SOUND" });
  
  chrome.storage.local.get(['currentTask'], (data) => {
     if(data.currentTask) alert(`🎉 Chúc mừng bạn đã hoàn thành Task: "${data.currentTask.name}"!`);
     chrome.runtime.sendMessage({ action: "STOP_TIMER" });
     
     // Reset input và counter
     if(taskInput) {
       taskInput.value = "";
       charCounter.innerText = "0/50";
       charCounter.style.color = "#888888";
       charCounter.style.fontWeight = "normal";
     }
     
     setTimeout(() => {
       updateUI();
     }, 150);
  });
}

  btnStart.addEventListener('click', () => handleStart(taskInput.value.trim()));
  btnPause.addEventListener('click', () => handlePauseResume(btnPause.innerText));
  btnDone.addEventListener('click', handleStop);

  // --- 5. HISTORY & SETTINGS ---
  function renderHistory() {
    chrome.storage.local.get(['history'], (data) => {
      const history = data.history || [];
      taskListContainer.innerHTML = ""; 
      if (history.length === 0) {
        taskListContainer.innerHTML = "<p class='text-center' style='color:var(--color-text-secondary); margin-top:20px;'>Chưa có công việc nào hoàn thành.</p>";
        return;
      }
      history.forEach(item => {
        const endObj = new Date(item.endTime);
        const dateStr = endObj.toLocaleDateString('vi-VN');
        
        // Calculate start time from endTime - totalDuration
        const startObj = item.startTime 
          ? new Date(item.startTime) 
          : new Date(item.endTime - (item.totalDuration * 60 * 1000));
        
        const startTimeStr = startObj.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
        const endTimeStr = endObj.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
        
        const div = document.createElement('div');
        div.className = "task-item";
        div.innerHTML = `
          <div class="task-info">
            <h4 style="color: var(--color-brand);">${item.name}</h4>
            <div class="task-meta">
                <span>📅 ${dateStr}</span><br>
                <span>🕐 ${startTimeStr} → ${endTimeStr}</span> | 
                <span>🍅 ${item.sessionsCount} Phiên</span>
            </div>
          </div>
          <div class="task-badge" style="background: var(--color-surface); border: 1px solid var(--color-border);">
            ⏱ ${item.totalDuration} phút
          </div>
        `;
        taskListContainer.appendChild(div);
      });
    });
  }

  function loadSettings() {
    chrome.storage.local.get(['settings'], (data) => {
      if (data.settings) {
        document.getElementById('setting-focus').value = data.settings.focusTime;
        document.getElementById('setting-short').value = data.settings.shortBreak;
        document.getElementById('setting-long').value = data.settings.longBreak;
        document.getElementById('setting-cycle').value = data.settings.longBreakInterval;
        document.getElementById('setting-sound').checked = data.settings.soundEnabled;
      }
    });
  }
  
  btnSaveSettings.addEventListener('click', () => {
    const newSettings = {
      focusTime: parseInt(document.getElementById('setting-focus').value),
      shortBreak: parseInt(document.getElementById('setting-short').value),
      longBreak: parseInt(document.getElementById('setting-long').value),
      longBreakInterval: parseInt(document.getElementById('setting-cycle').value),
      soundEnabled: document.getElementById('setting-sound').checked
    };
    chrome.storage.local.set({ settings: newSettings }, () => {
        alert("Đã lưu cài đặt! Áp dụng ngay lập tức.");
        updateUI();
    });
  });

  btnClearHistory.addEventListener('click', () => {
    if (confirm("Xóa toàn bộ lịch sử?")) chrome.storage.local.set({ history: [] }, renderHistory);
  });

 // --- 6. ALWAYS-ON-TOP MINI WINDOW (DISABLED) ---
 btnPip.addEventListener('click', async () => {
   alert("Tính năng PiP đang được phát triển!");
 });
});