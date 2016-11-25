const PRIVATE_TOKEN = '7-k3Pak8M6UJuayNrx3i'
var listOfMRs, setOfChanges, setOfIds

function init(url) {
  const { origin, pathname, searchParams } = new URL(url)
  const [ page, projectName, ...rest ] = pathname.split('/').filter(e => e).reverse()

  listOfMRs = new Map
  setOfChanges = new Set
  setOfIds = new Set

  // Fetch merge requests info and diff description to MR list
  const headers = new Headers
        headers.append('PRIVATE-TOKEN', PRIVATE_TOKEN)
  const options = {
    method: 'GET',
    mode: 'cors',
    cache: 'default',
    headers,
  }

  fetch(`${origin}/api/v3/projects/`, options)
  .then(data => data.json())
  .then(projects => {
    const projectId = projects.find(proj => proj.name == projectName).id
    fetch(
      `${origin}/api/v3/projects/${projectId}/merge_requests?state=opened`,
      options
    )
    .then(data => data.json())
    .then(json => {
      const allChanges = json.map(({ id, iid }) => fetch(
        `${origin}/api/v3/projects/${projectId}/merge_requests/${id}/changes`,
        options
      )
      .then(data => data.json())
      .then(({ changes }) => getMergeUpdates(changes, iid)));

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
  })
  .catch(err => { console.error('Failed to fetch projects list:', err) })

  insertSortLinks()
}

function insertSortLinks() {
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
    class: 'mrs-sort-link',
    'data-direction': 'asc',
  })
  const $moreLink = create('a', 'More changes', {
    href: '!#',
    disabled: true,
    class: 'mrs-sort-link',
    'data-direction': 'desc',
  })

  $lessLink.addEventListener('click', changeCurrentSort)
  $moreLink.addEventListener('click', changeCurrentSort)

  $sortingList.append($lessLink, $moreLink);
}

function sortMergeRequests(dir) {
  const $mergeRequests = new DocumentFragment
  const $list = $('.mr-list')
  const $newList = $list.cloneNode()

  // If user has filtered his MRs somehow
  const filtered = $list.children.length < setOfChanges.size
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



/*
 * Utils
 */

var $ = document.querySelector.bind(document)
var $$ = document.querySelectorAll.bind(document)

// Simple node building
function create(tag, content, options) {
  const $el = document.createElement(tag)
  $el.textContent = content

  Object.entries(options).forEach(([key, value]) => {
    $el.setAttribute(key, value)
  });

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

  const $c = create('span', '', { class: 'mrs-changes' })
  const $added = create('span', `+${added}`, { class: 'mrs-gitlab-added' })
  const $removed = create('span', `-${removed}`, { class: 'mrs-gitlab-removed' })

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
  chrome.storage.local.set({ initialized: true }, () => init(url))
})
