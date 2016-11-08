const hostFilters =
{
  url: [
    {
      hostContains: 'gitlab.',
      urlContains: '/merge_requests?',
    },
    {
      hostContains: 'gitlab.',
      urlSuffix: '/merge_requests',
    },
    {
      hostContains: 'gitlab.',
      urlSuffix: '/merge_requests/',
    },
  ],
}

chrome.webNavigation.onHistoryStateUpdated.addListener(function(data) {
  chrome.storage.local.set({ initialized: false })

  const interval = setInterval(function() {
    chrome.storage.local.get('initialized', function({ initialized }) {
      if (initialized) return clearInterval(interval)

      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, data)
      })
    })
  }, 500)
},
hostFilters);
