// Initialize side panel
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

let collectorWindow = null;

// Handle extension icon click
chrome.action.onClicked.addListener(() => {
  if (collectorWindow && !chrome.runtime.lastError) {
    // Focus existing window
    chrome.windows.update(collectorWindow.id, { focused: true });
  } else {
    // Create new window
    chrome.windows.create({
      url: 'collector.html',
      type: 'popup',
      width: 320,
      height: 500
    }, (window) => {
      collectorWindow = window;
    });
  }
});

// Handle window close
chrome.windows.onRemoved.addListener((windowId) => {
  if (collectorWindow && collectorWindow.id === windowId) {
    collectorWindow = null;
  }
});

// Handle side panel toggle
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggleSidePanel') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      try {
        await chrome.sidePanel.setOptions({
          tabId: tabs[0].id,
          path: 'sidepanel.html',
          enabled: true
        });
        await chrome.sidePanel.toggle();
      } catch (error) {
        console.error('Error toggling side panel:', error);
      }
    });
  }
}); 