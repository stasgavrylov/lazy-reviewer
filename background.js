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

const initialize = function(data) {
  if (!data.transitionType && data.url.includes('gitlab')) return

  chrome.storage.local.set({ initialized: false })
  var initCounter = 0

  // Sometimes tab message is sent when the page has not loaded yet,
  // several tries provide more stable initialization
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
}

// On first page load GitLab fires both 'onHistoryStateUpdated' and 'onCompleted',
// but GitHub fires only the latter, so we need to listen to both events.
chrome.webNavigation.onHistoryStateUpdated.addListener(initialize, hostFilters)
chrome.webNavigation.onCompleted.addListener(initialize, hostFilters)
