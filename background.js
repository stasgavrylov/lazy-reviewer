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
  var initCounter = 0

  const interval = setInterval(function() {
    chrome.storage.local.get('initialized', function({ initialized }) {
      if (initialized) return clearInterval(interval)

      // Give up after 10 tries
      if (initCounter > 10) {
        console.error('Unable to initialize extension. Try to reload the page')
        return clearInterval(interval)
      }

      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (!tabs[0]) return
        chrome.tabs.sendMessage(tabs[0].id, data)
      })

      initCounter++
    })
  }, 500)
},
hostFilters)
