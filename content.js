class Service {
  constructor() {
    this.listOfPRs = new Map
    this.setOfChanges = new Set
    this.setOfIds = new Set
  }

  init(url, privateKey) {
    this.privateKey = privateKey
    this.checkPrivateKey()

    const { host, origin, pathname, searchParams } = new URL(url)
    const [ page, project, namespace, ...rest ] = pathname.split('/').filter(e => e).reverse()
    const options = {
      method: 'GET',
      headers: this.getRequestHeaders(),
    }
    this.fetch({ origin, namespace, project, options }).then(() => {
      this.insertSortLinks()
      this.unlockUI()
    })
  }

  checkPrivateKey() {
    if (!this.privateKey) this.promptKey()
  }

  // If user hasn't set his API key yet, prompt once again or shut down.
  promptKey() {
    this.privateKey = prompt(`You haven't provided ${host} API key yet.`)
    if (!this.privateKey) {
      throw new Error('No API key found for this host. LazyReviewer will not run.')
    } else chrome.storage.local.set({ [host]: true })
  }

  getRequestHeaders() {
    return { [this.getTokenHeader()]: this.getToken() }
  }

  buildDiffMarkup(added, removed) {
    const $c = create('span', '', { class: 'lrwr-changes' })
    const $added = create('span', `+${added}`, { class: 'lrwr-added' })
    const $removed = create('span', `-${removed}`, { class: 'lrwr-removed' })

    $c.append($added, $removed)
    return $c
  }

  // Add [+ -] changes to PR link
  appendLinkMarkup(added, removed) {
    this.prLink.append(this.buildDiffMarkup(added, removed))
  }

  // Save corresponding list item node for sorting
  saveLinkNode(id, total) {
    const $listEntry = this.prLink.closest(this.selectors.parentLink)

    const pullsArray = this.listOfPRs.has(total) ? this.listOfPRs.get(total) : []

    this.listOfPRs.set(total, [ ...pullsArray, { node: $listEntry, id } ])
    this.setOfChanges.add(total)
    this.setOfIds.add(id)
  }

  displayDiffs(changes) {
    changes.forEach(({ id, added, removed }) => {
      if (this.setOfIds.has(id)) return

      this.prLink = this.getPRlink(id)
      if (!this.prLink || this.prLink.querySelector('.lrwr-changes')) return

      this.appendLinkMarkup(added, removed)

      const totalChanges = added + removed
      this.saveLinkNode(id, totalChanges)
    })
  }

  buildSortLinks(handler, className) {
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

    return [$lessLink, $moreLink]
  }

  sortRequests(dir) {
    const $requests = new DocumentFragment

    const $list = $(this.selectors.list)
    const $newList = $list.cloneNode()

    // If user has filtered his PRs somehow
    const filtered = $list.children.length < this.setOfIds.size
    const filteredIds = filtered &&
      [ ...$list.querySelectorAll(this.selectors.links) ]
        .map(node => +node.href.split('/').pop())

    ![ ...this.setOfChanges ]
      .sort((a, b) => dir === 'asc' ? a - b : b - a)
      .forEach(count => {
        const items = this.listOfPRs.get(count)
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

  unlockUI() {
    for (let $link of $$('.lrwr-sort-link')) { $link.removeAttribute('disabled') }
  }
}

class GitLabService extends Service {
  constructor() {
    super()

    this.selectors = {
      parentLink: '.merge-request',
      list: '.mr-list',
      links: '.merge-request-title-text > a',
    }
  }

  fetch({ namespace, project, origin, options }) {
    return fetch(`${origin}/api/v3/projects/${namespace}%2F${project}/merge_requests?state=opened`, options)
      .then(response => {
        if (!response.ok) throw new Error(`Server responded with status ${response.status}`)

        return response.json()
      })
      .then(json => {
        const allChanges = json.map(({ id, iid, project_id }) => fetch(
          `${origin}/api/v3/projects/${project_id}/merge_requests/${id}/changes`,
          options
        )
        .then(data => data.json())
        .then(({ changes }) => this.getMergeUpdates(changes, iid)))

        return Promise.all(allChanges)
          .catch(function(err) {
              console.error('Failed to get merge request changes:', err)
          })
          .then(changes => this.displayDiffs(changes))
      })
      .catch(err => { console.error('Failed to fetch projects list:', err) })
  }

  // Calculating diffs for merge request
  getMergeUpdates(changes, id) {
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

  insertSortLinks() {
    const $sortingMenu = $('.issues-filters .dropdown-menu-sort')
    const $sortingList = $sortingMenu.firstElementChild
    const $sortingButton = $sortingMenu.previousElementSibling

    const changeCurrentSort = (e) => {
      e.preventDefault()
      $sortingButton.childNodes[2].textContent = e.target.textContent
      this.sortRequests(e.target.dataset.direction)
    }

    $sortingList.append(...this.buildSortLinks(changeCurrentSort))
  }

  getPRlink(id) {
    return $(`a[href$='merge_requests/${id}']`)
  }

  getToken() {
    return this.privateKey
  }

  getTokenHeader() {
    return 'PRIVATE-TOKEN'
  }
}

class GitHubService extends Service {
  constructor() {
    super()

    this.selectors = {
      parentLink: '.js-navigation-item',
      list: '.issues-listing ul.js-navigation-container',
      links: 'li a.Box-row-link.js-navigation-open',
    }
  }

  fetch({ namespace, project, options }) {
    return fetch(`https://api.github.com/repos/${namespace}/${project}/pulls`, options)
    .then(response => {
      if (!response.ok) throw new Error(`Server responded with status ${response.status}`)

      return response.json()
    })
    .then(pulls => {
      const allChanges = pulls.map(it => fetch(it.url, options)
        .then(data => data.json())
        .then(({ additions, deletions, number }) => ({
          added: additions,
          removed: deletions,
          id: number,
        })))

      return Promise.all(allChanges)
        .catch(function(err) {
            console.error('Failed to get pull request changes:', err)
        })
        .then(changes => this.displayDiffs(changes))
    })
    .catch(err => { console.error('Failed to fetch projects list:', err) })
  }

  insertSortLinks() {
    const $sortingList = [ ...$$('.table-list-filters .js-menu-container .js-navigation-open') ].pop()

    const changeCurrentSort = (e) => {
      e.preventDefault()
      this.sortRequests(e.target.dataset.direction)
    }

    $sortingList.after(...this.buildSortLinks(changeCurrentSort, 'select-menu-item js-navigation-item js-navigation-open'))
  }

  getPRlink(id) {
    return $(`a[href$='pull/${id}']`)
  }

  getToken() {
    return `token ${this.privateKey}`
  }

  getTokenHeader() {
    return 'Authorization'
  }
}

/*
 * Utils
 */

const $ = document.querySelector.bind(document)
const $$ = document.querySelectorAll.bind(document)

function getService(service) {
  switch(service) {
    case 'gitlab':
      return new GitLabService
    case 'github':
      return new GitHubService
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

// Calculate number of added and removed lines
function occurrences(string, subString) {
  var n = 0, pos = 0, step = subString.length

  while (true) {
    pos = string.indexOf(subString, pos)
    if (pos >= 0) {
      n++
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

    chrome.storage.local.get(host, function({ [host]: { key, service } }) {
      getService(service).init(url, key)
    })
  })
})
