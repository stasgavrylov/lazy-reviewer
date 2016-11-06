function init(url) {
  const $sortingMenu = document.querySelector('.issues-filters .dropdown-menu-sort')
  const $sortingList = $sortingMenu.firstElementChild
  const $sortingButton = $sortingMenu.previousElementSibling

  console.log(url.split('/'))

  const $link = document.createElement('a')
  $link.textContent = 'Less lines'
  $link.href = '#'

  $link.addEventListener('click', (e) => {
    e.preventDefault()
    $sortingButton.childNodes[2].textContent = $link.textContent
  })

  $sortingList.prepend($link)

  // API key - 7-k3Pak8M6UJuayNrx3i
  // 9JLaib3pXzuGKjsfqn8K

  const mergeRequests = []
  fetch(
    'https://gitlab.railsreactor.com/api/v3/projects/60/merge_requests?state=opened&private_token=7-k3Pak8M6UJuayNrx3i',
    // 'https://gitlab.railsreactor.com/api/v3/projects/60/merge_requests/9945/changes?private_token=7-k3Pak8M6UJuayNrx3i',
    {
      method: 'GET',
      mode: 'cors',
    }
  )
  .then(data => data.json())
  .then(json => {
    const allChanges = json.map(({ id, iid }) => fetch(
      `https://gitlab.railsreactor.com/api/v3/projects/60/merge_requests/${id}/changes?private_token=7-k3Pak8M6UJuayNrx3i`,
      { method: 'GET', mode: 'cors' }
    )
    .then(data => data.json())
    .then(({ changes }) => getMergeUpdates(changes, iid)));

    Promise.all(allChanges)
      .catch(function(err) {
          console.log('Failed to get merge request changes:', err)
          return allChanges
      })
      .then(changes => {
        changes.forEach(({ id, added, removed }) => {
          const $mergeLink = document.querySelector(`a[href="/partners/partners-insight4-all/merge_requests/${id}"]`)
          $mergeLink.insertAdjacentHTML('beforeend',
            `<span class="mrs-changes">
              [<span class="mrs-added">+${added}</span> <span class="mrs-removed">-${removed}</span>]
            </span>
          `)
      })
    })
  })
}



/*
 * Utils
 */

function getMergeUpdates(changes, id) {
  const addedLineMarker = '\n+'
  const removedLineMarker = '\n-'

  return changes.map(({ diff }) => ({
    added: occurrences(diff, addedLineMarker) - 1, // because diff description also starts with \n+
    removed: occurrences(diff, removedLineMarker),
  }))
  .reduce((total, change) => {
    total.added += change.added
    total.removed += change.removed
    return total
  }, { added: 0, removed: 0, id })
}

function occurrences(string, subString) {
  if (subString.length <= 0) return (string.length + 1);

  var n = 0,
      pos = 0,
      step = subString.length;

  while (true) {
      pos = string.indexOf(subString, pos);
      if (pos >= 0) {
          ++n;
          pos += step;
      } else break;
  }
  return n;
}

/*
 * Initialization
 */

// $sortingList.addEventListener('click', insertLinks)
chrome.runtime.onMessage.addListener(function({ url }, sender) {
  init(url);
});
