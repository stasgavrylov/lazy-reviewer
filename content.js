var listOfPRs, setOfChanges, setOfIds

const utilsStorage = {
  github: {
    tokenHeader: 'Authorization',
    getToken: getToken('github'),
    insertSort: insertGitHubSort,
    fetch: fetchGitHub,
  },
  gitlab: {
    tokenHeader: 'PRIVATE-TOKEN',
    getToken: getToken('gitlab'),
    insertSort: insertGitLabSort,
    fetch: fetchGitLab,
  },
}

function init(url, privateKey, service) {
  const { host, origin, pathname, searchParams } = new URL(url)
  const [ page, project, namespace, ...rest ] = pathname.split('/').filter(e => e).reverse()

  // If user hasn't set his API key yet, prompt once again or shut down.
  if (!privateKey) {
    privateKey = prompt(`You haven't provided ${host} API key yet.`)
    if (!privateKey) {
      console.warn('No API key found for this host. LazyReviewer will not run.')
      return
    } else chrome.storage.local.set({ [host]: true })
  }

  const utils = utilsStorage[service]

  listOfPRs = new Map
  setOfChanges = new Set
  setOfIds = new Set

  // Fetch merge requests info and diff description to MR list
  const headers = new Headers
        headers.append(utils.tokenHeader, utils.getToken(privateKey))
  const options = {
    method: 'GET',
    mode: 'cors',
    cache: 'default',
    headers,
  }

  utils.fetch({ origin, namespace, project }, options)
  utils.insertSort()
}

function fetchGitLab({ origin, namespace, project }, options) {
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

        const mrArray = listOfPRs.has(total) ? listOfPRs.get(total) : []

        listOfPRs.set(total, [ ...mrArray, { node: $mrListItem, id } ])
        setOfChanges.add(total)
        setOfIds.add(id)
      })

      for (let $link of $$('.lrwr-sort-link')) { $link.removeAttribute('disabled') }
    })
  })
  .catch(err => { console.error('Failed to fetch projects list:', err) })
}

function fetchGitHub({ namespace, project }, options) {
  fetch(`https://api.github.com/repos/${namespace}/${project}/pulls`, options)
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
}

function insertGitLabSort() {
  const $sortingMenu = $('.issues-filters .dropdown-menu-sort')
  const $sortingList = $sortingMenu.firstElementChild
  const $sortingButton = $sortingMenu.previousElementSibling

  function changeCurrentSort(e) {
    e.preventDefault()
    $sortingButton.childNodes[2].textContent = this.textContent
    sortRequests('gitlab')(this.dataset.direction)
  }

  $sortingList.append(...buildSortLinks(changeCurrentSort))
}

function insertGitHubSort() {
  const $sortingList = [ ...$$('.table-list-filters .js-menu-container .js-navigation-open') ].pop()

  function changeCurrentSort(e) {
    e.preventDefault()
    sortRequests('github')(this.dataset.direction)
  }

  $sortingList.after(...buildSortLinks(changeCurrentSort, 'select-menu-item js-navigation-item js-navigation-open'))
}

function sortRequests(service) {
  const selectors = {
    'gitlab': {
      list: '.mr-list',
      links: '.merge-request-title-text > a',
    },
    'github': {
      list: '.issues-listing .Box-body.js-navigation-container',
      links: 'li a.Box-row-link.js-navigation-open',
    }
  }

  return function (dir) {
    const $requests = new DocumentFragment
    const selector = selectors[service]

    const $list = $(selector.list)
    const $newList = $list.cloneNode()

    // If user has filtered his MRs somehow
    const filtered = $list.children.length < setOfIds.size
    const filteredIds = filtered &&
      [ ...$list.querySelectorAll(selector.links) ]
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

        $requests.append( ...items )
      })
    $newList.append($requests)
    $list.replaceWith($newList)
  }
}

function buildSortLinks(handler, className) {
  const $lessLink = create('a', 'Less changes', {
    href: '!#',
    disabled: true,
    class: 'lrwr-sort-link ' + className,
    'data-direction': 'asc',
  })
  const $moreLink = create('a', 'More changes', {
    href: '!#',
    disabled: true,
    class: 'lrwr-sort-link ' + className,
    'data-direction': 'desc',
  })

  $lessLink.addEventListener('click', handler)
  $moreLink.addEventListener('click', handler)

  return [ $lessLink, $moreLink ]
}



/*
 * Utils
 */

const $ = document.querySelector.bind(document)
const $$ = document.querySelectorAll.bind(document)

function getToken(service) {
  return function(key) {
    switch(service) {
      case 'github':
        return `token ${key}`
      case 'gitlab':
        return key
      default:
        return ''
    }
  }
}

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
  const $c = create('span', '', { class: 'lrwr-changes' })
  const $added = create('span', `+${added}`, { class: 'lrwr-added' })
  const $removed = create('span', `-${removed}`, { class: 'lrwr-removed' })

  $c.append($added, $removed)
  return $c
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
    const service = host.includes('github') ? 'github' : 'gitlab'

    chrome.storage.local.get(host, function({ [host]: key }) {
      init(url, key, service)
    })
  })
})
