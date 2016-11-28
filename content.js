var listOfMRs, setOfChanges, setOfIds

function init(url, privateKey) {
  const { origin, pathname, searchParams } = new URL(url)
  const [ page, project, namespace, ...rest ] = pathname.split('/').filter(e => e).reverse()

  // If user hasn't set his API key yet, prompt once again or shut down.
  if (!privateKey) {
    privateKey = prompt(`You haven't provided ${origin} API key yet.`)
    if (!privateKey) {
      console.warn('No API key found for this host. LazyReviewer will not run.')
      return
    }
  }

  listOfMRs = new Map
  setOfChanges = new Set
  setOfIds = new Set

  // Fetch merge requests info and diff description to MR list
  const headers = new Headers
        headers.append('PRIVATE-TOKEN', privateKey)
  const options = {
    method: 'GET',
    mode: 'cors',
    cache: 'default',
    headers,
  }

  fetch(`${origin}/api/v3/projects/${namespace}%2F${project}/merge_requests?state=opened`, options)
  .then(data => {
    if (data.status !== 200) throw new Error(`Server responded with status ${data.status}`)

    return data.json()
  })
  .then(json => {
    const allChanges = json.map(({ id, iid, project_id }) => fetch(
      `${origin}/api/v3/projects/${project_id}/merge_requests/${id}/changes`,
      options
    )
    .then(data => data.json())
    .then(({ changes }) => getMergeUpdates(changes, iid)))

    Promise.all(allChanges)
    .catch(function(err) {
        console.error('Failed to get merge request changes:', err)
        return allChanges
    })
    .then(changes => {
      changes.forEach(({ id, added, removed }) => {
        if (setOfIds.has(id)) return

        const $mrLink = $(`a[href$="merge_requests/${id}"]`)
        if (!$mrLink) return

        // Add [+ -] changes to MR link
        $mrLink.append(buildDiffMarkup(added, removed))

        // Save corresponding list item node for sorting
        const $mrListItem = $mrLink.closest('.merge-request')
        const total = added + removed

        const mrArray = listOfMRs.has(total) ? listOfMRs.get(total) : []

        listOfMRs.set(total, [ ...mrArray, { node: $mrListItem, id } ])
        setOfChanges.add(total)
        setOfIds.add(id)
      })

      for (let $link of $$('.mrs-sort-link')) { $link.removeAttribute('disabled') }
    })
  })
  .catch(err => { console.error('Failed to fetch projects list:', err) })

  insertGitLabSort()
}

function initGitHub(url, privateKey) {
  const { origin, pathname, searchParams } = new URL(url)
  const [ page, project, namespace, ...rest ] = pathname.split('/').filter(e => e).reverse()

  // If user hasn't set his API key yet, prompt once again or shut down.
  if (!privateKey) {
    privateKey = prompt(`You haven't provided ${origin} API key yet.`)
    if (!privateKey) {
      console.warn('No API key found for this host. LazyReviewer will not run.')
      return
    }
  }

  listOfPRs = new Map
  setOfChanges = new Set
  setOfIds = new Set

  // Fetch merge requests info and diff description to MR list
  const headers = new Headers
        headers.append('Authorization', `token ${privateKey}`)
  const options = {
    method: 'GET',
    mode: 'cors',
    cache: 'default',
    headers,
  }

  fetch(`https://api.github.com/repos/${project}/${namespace}/pulls`, options)
  .then(data => {
    if (data.status !== 200) throw new Error(`Server responded with status ${data.status}`)

    return data.json()
  })
  .then(pulls => {
    const allChanges = pulls.map(it => fetch(it.url, options)
      .then(data => data.json())
      .then(({ additions, deletions, number }) => ({
        added: additions,
        removed: deletions,
        id: number,
      })))

    Promise.all(allChanges)
    .catch(function(err) {
        console.error('Failed to get pull request changes:', err)
        return allChanges
    })
    .then(changes => {
      changes.forEach(({ id, added, removed }) => {
        if (setOfIds.has(id)) return

        const $prLink = $(`a[href$="pull/${id}"]`)
        if (!$prLink) return

        // Add [+ -] changes to PR link
        $prLink.append(buildDiffMarkup(added, removed))

        // Save corresponding list item node for sorting
        const $prListItem = $prLink.closest('.js-navigation-item')
        const total = added + removed

        const prArray = listOfPRs.has(total) ? listOfPRs.get(total) : []

        listOfPRs.set(total, [ ...prArray, { node: $prListItem, id } ])
        setOfChanges.add(total)
        setOfIds.add(id)
      })

      for (let $link of $$('.lrwr-sort-link')) { $link.removeAttribute('disabled') }
    })
  })
  .catch(err => { console.error('Failed to fetch projects list:', err) })

  insertGitHubSort()
}

function insertGitLabSort() {
  const $sortingMenu = $('.issues-filters .dropdown-menu-sort')
  const $sortingList = $sortingMenu.firstElementChild
  const $sortingButton = $sortingMenu.previousElementSibling

  function changeCurrentSort(e) {
    e.preventDefault()
    $sortingButton.childNodes[2].textContent = this.textContent
    sortMergeRequests(this.dataset.direction)
  }

  const $lessLink = create('a', 'Less changes', {
    href: '!#',
    disabled: true,
    class: 'lrwr-sort-link',
    'data-direction': 'asc',
  })
  const $moreLink = create('a', 'More changes', {
    href: '!#',
    disabled: true,
    class: 'lrwr-sort-link',
    'data-direction': 'desc',
  })

  $lessLink.addEventListener('click', changeCurrentSort)
  $moreLink.addEventListener('click', changeCurrentSort)

  $sortingList.append($lessLink, $moreLink)
}
function insertGitHubSort() {
  const $sortingList = [ ...$$('.table-list-filters .js-menu-container .js-navigation-open') ].pop()

  function changeCurrentSort(e) {
    e.preventDefault()
    sortPullRequests(this.dataset.direction)
  }

  const $lessLink = create('a', 'Less changes', {
    href: '!#',
    disabled: true,
    class: 'lrwr-sort-link select-menu-item js-navigation-item js-navigation-open',
    'data-direction': 'asc',
  })
  const $moreLink = create('a', 'More changes', {
    href: '!#',
    disabled: true,
    class: 'lrwr-sort-link select-menu-item js-navigation-item js-navigation-open',
    'data-direction': 'desc',
  })

  $lessLink.addEventListener('click', changeCurrentSort)
  $moreLink.addEventListener('click', changeCurrentSort)

  $sortingList.after($lessLink, $moreLink)
}

function sortMergeRequests(dir) {
  const $mergeRequests = new DocumentFragment
  const $list = $('.mr-list')
  const $newList = $list.cloneNode()

  // If user has filtered his MRs somehow
  const filtered = $list.children.length < setOfIds.size
  const filteredIds = filtered &&
    [ ...$list.querySelectorAll('.merge-request-title-text > a') ]
      .map(node => +node.href.split('/').pop())

  ![ ...setOfChanges ]
    .sort((a, b) => dir === 'asc' ? a - b : b - a)
    .forEach(count => {
      const items = listOfMRs.get(count)
        .map(({ node, id }) => {
          if (filtered) {
            return filteredIds.includes(id) ? node.cloneNode(true) : null
          }

          return node.cloneNode(true)
        })
        .filter(node => node)

      $mergeRequests.append( ...items )
    })
  $newList.append($mergeRequests)
  $list.replaceWith($newList)
}

function sortPullRequests(dir) {
  const $pullRequests = new DocumentFragment
  const $list = $('.issues-listing .Box-body.js-navigation-container')
  const $newList = $list.cloneNode()

  // If user has filtered his PRs somehow
  const filtered = $list.children.length < setOfIds.size
  const filteredIds = filtered &&
    [ ...$list.querySelectorAll('li a.Box-row-link.js-navigation-open') ]
      .map(node => +node.href.split('/').pop())

  ![ ...setOfChanges ]
    .sort((a, b) => dir === 'asc' ? a - b : b - a)
    .forEach(count => {
      const items = listOfPRs.get(count)
        .map(({ node, id }) => {
          if (filtered) {
            return filteredIds.includes(id) ? node.cloneNode(true) : null
          }

          return node.cloneNode(true)
        })
        .filter(node => node)

      $pullRequests.append( ...items )
    })
  $newList.append($pullRequests)
  $list.replaceWith($newList)
}



/*
 * Utils
 */

const $ = document.querySelector.bind(document)
const $$ = document.querySelectorAll.bind(document)

// Simple node building
function create(tag, content, options) {
  const $el = document.createElement(tag)
  $el.textContent = content

  Object.entries(options).forEach(([key, value]) => {
    $el.setAttribute(key, value)
  })

  return $el
}

// Calculating diffs for merge request
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

// Couple of spans to display diffs
function buildDiffMarkup(added, removed) {
  const $f = new DocumentFragment

  const $c = create('span', '', { class: 'lrwr-changes' })
  const $added = create('span', `+${added}`, { class: 'lrwr-added' })
  const $removed = create('span', `-${removed}`, { class: 'lrwr-removed' })

  $c.append($added, $removed)
  $f.append($c)
  return $f
}

// Calculate number of added and removed lines
function occurrences(string, subString) {
  var n = 0, pos = 0, step = subString.length

  while (true) {
    pos = string.indexOf(subString, pos)
    if (pos >= 0) {
        ++n
        pos += step
    }
    else break
  }
  return n
}

/*
 * Initialization
 */
chrome.runtime.onMessage.addListener(function({ url }, sender) {
  chrome.storage.local.set({ initialized: true }, function() {
    const { host } = new URL(url)
    chrome.storage.local.get(host, function({ [host]: key }) {
      initGitHub(url, key)
    })
  })
})
