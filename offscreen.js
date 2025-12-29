const audio = document.getElementById('alarm-sound');
audio.loop = false; // 1 phút rồi tự dừng

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "PLAY_SOUND") {
    audio.currentTime = 0;
    audio.play()
      .then(() => {
        console.log('🔊 Alarm sound playing...');
        sendResponse({ status: "OK" });
      })
      .catch(err => {
        console.error('Sound play error:', err);
        sendResponse({ status: "ERROR", error: err.message });
      });
    return true;
  } else if (request.action === "STOP_SOUND") {
    audio.pause();
    audio.currentTime = 0;
    console.log('🔇 Alarm sound stopped');
    sendResponse({ status: "OK" });
    return true;
  }
});

console.log('Offscreen audio player ready');