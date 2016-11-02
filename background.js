chrome.webNavigation.onHistoryStateUpdated.addListener(function(data) {
    if (data) {
      console.log('data', data);
    }
  },
  { url: [
    {
      hostContains: 'gitlab.',
      urlContains: '/merge_requests?'
    },
    {
      hostContains: 'gitlab.',
      urlSuffix: '/merge_requests'
    },
]});