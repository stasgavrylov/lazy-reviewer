// onInstalled is called with every extension update, and we don't want to
// overwrite saved hosts
chrome.runtime.onInstalled.addListener(function() {
  chrome.storage.local.get('hosts', function({ hosts }) {
    if (hosts) return
    chrome.storage.local.set({ 'hosts': ['github.com', 'gitlab.com'] })
  })
})

const initialize = function(data) {
  if (!data.transitionType && data.url.includes('gitlab')) return

  chrome.storage.local.set({ initialized: false })

  // Sometimes tab message is sent when the page has not loaded yet,
  // several tries provide more stable initialization
  var failedInitializationAttempts = 0
  const interval = setInterval(function() {
    chrome.storage.local.get('initialized', function({ initialized }) {
      if (initialized) return clearInterval(interval)

      // Give up after 10 tries
      if (failedInitializationAttempts > 10) {
        console.error('Unable to initialize extension. Try to reload the page')
        return clearInterval(interval)
      }

      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (!tabs[0]) return
        chrome.tabs.sendMessage(tabs[0].id, data)
      })

      failedInitializationAttempts++
    })
  }, 500)
}

// Create event url filters to specify pages where we want to run the extension at
const PR_PAGE_REGEX = '/(pulls|merge_requests)(\/|\\?.*)?$' // re2 syntax
setUrlFilters()

function setUrlFilters() {
  chrome.storage.local.get('hosts', function({ hosts }) {
    const hostFilters = hosts.reduce(function(filters, host) {
      return {
        url: [
          ...filters.url,
          { hostContains: host, urlMatches: PR_PAGE_REGEX }
        ],
      }
    }, { url: [] })

    // On first page load GitLab fires both 'onHistoryStateUpdated' and 'onCompleted',
    // but GitHub fires only the latter, so we need to listen to both events.
    chrome.webNavigation.onHistoryStateUpdated.addListener(initialize, hostFilters)
    chrome.webNavigation.onCompleted.addListener(initialize, hostFilters)
  })

}


// If user adds new hosts
chrome.storage.onChanged.addListener(function({ hosts }, namespace) {
  if (namespace == 'local' && hosts) updateUrlFilters()
});

function updateUrlFilters() {
  chrome.webNavigation.onHistoryStateUpdated.removeListener(initialize)
  chrome.webNavigation.onHistoryStateUpdated.removeListener(initialize)
  setUrlFilters()
}
