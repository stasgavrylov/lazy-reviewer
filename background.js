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
    {
      hostContains: 'github.',
      urlContains: '/pulls?',
    },
    {
      hostContains: 'github.',
      urlSuffix: '/pulls',
    },
    {
      hostContains: 'github.',
      urlSuffix: '/pulls/',
    },
  ],
}

// On first page load GitLab fires both 'onHistoryStateUpdated' and 'onCompleted',
// but GitHub fires only the latter, so we need to listen to both events.
chrome.webNavigation.onHistoryStateUpdated.addListener(function(data) {
  console.log('history');
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

chrome.webNavigation.onCompleted.addListener(function(data) {
  console.log('completed');
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
