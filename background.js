const hostFilters = { url: [
  {
    hostContains: 'gitlab.',
    urlContains: '/merge_requests?'
  },
  {
    hostContains: 'gitlab.',
    urlSuffix: '/merge_requests'
  },
]}

chrome.webNavigation.onHistoryStateUpdated.addListener(function(data) {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, data);
  });
},
hostFilters);

chrome.webNavigation.onDOMContentLoaded.addListener(function(data) {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, data);
  });
},
hostFilters);
