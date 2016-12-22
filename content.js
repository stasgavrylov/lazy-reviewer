class Service {
  constructor(url, privateKey) {
    this.listOfPRs = new Map
    this.setOfChanges = new Set
    this.setOfIds = new Set
    this.privateKey = privateKey

    this.init(url)
  }

  init(url) {
    const { host, pathname } = new URL(url)
    const [ project, namespace ] = pathname.split('/').filter(e => e).slice(0, -1).reverse()

    this.host = host
    this.checkPrivateKey()

    this.fetch({ namespace, project }).then(diffs => {
      this.displayDiffs(diffs)
      this.insertSortLinks()
      this.unlockUI()
    }, err => console.error('Failed to get merge request changes:', err))
  }

  checkPrivateKey() {
    if (!this.privateKey) this.promptKey()
  }

  // If user hasn't set his API key yet, prompt once again or shut down.
  promptKey() {
    this.privateKey = prompt(`You haven't provided ${this.host} API key yet.`)
    if (this.privateKey)
      chrome.storage.local.set({ [this.host]: true })
    else
      throw new Error('No API key found for this host. LazyReviewer will not run.')
  }

  getFetchOptions() {
    return {
      headers: {
        [this.authHeader]: this.authToken,
      }
    }
  }

  buildDiffMarkup(added, removed) {
    const $diff = el`<span class="lrwr-changes"></span>`
    const $added = el`<span class="lrwr-added">+${added}</span>`
    const $removed = el`<span class="lrwr-removed">+${removed}</span>`

    $diff.firstElementChild.append($added, $removed)
    return $diff
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
    const $less = el`<a href=# disabled class="lrwr-sort-link ${className}" data-order=asc>Less changes</a>`
    const $more = el`<a href=# disabled class="lrwr-sort-link ${className}" data-order=desc>More changes</a>`

    $less.firstElementChild.addEventListener('click', handler)
    $more.firstElementChild.addEventListener('click', handler)

    return [$less, $more]
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
  constructor(...args) {
    super(...args)

    this.selectors = {
      parentLink: '.merge-request',
      list: '.mr-list',
      links: '.merge-request-title-text > a',
    }
  }

  async fetch({ namespace, project }) {
    const options = this.getFetchOptions()

    try {
      const response = await fetch(`/api/v3/projects/${namespace}%2F${project}/merge_requests?state=opened`, options)

      if (!response.ok) throw new Error(`Server responded with status ${response.status}`)

      const projectData = await response.json()

      const allChanges = projectData.map(async ({ id, iid, project_id }) => {
        const response = await fetch(`/api/v3/projects/${project_id}/merge_requests/${id}/changes`, options)
        const { changes } = await response.json()
        return this.getMergeUpdates(changes, iid)
      })

      return Promise.all(allChanges)
    }
    catch (err) {
      console.error('Failed to fetch data for LazyReviewer:', err)
    }
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
      this.sortRequests(e.target.dataset.order)
    }

    $sortingList.append(...this.buildSortLinks(changeCurrentSort))
  }

  getPRlink(id) {
    return $(`a[href$='merge_requests/${id}']`)
  }

  get authToken() {
    return this.privateKey
  }

  get authHeader() {
    return 'PRIVATE-TOKEN'
  }
}

class GitHubService extends Service {
  constructor(...args) {
    super(...args)

    this.selectors = {
      parentLink: '.js-navigation-item',
      list: '.issues-listing ul.js-navigation-container',
      links: 'li a.Box-row-link.js-navigation-open',
    }
  }

  async fetch({ namespace, project }) {
    const options = this.getFetchOptions()

    try {
      const response = await fetch(`https://api.github.com/repos/${namespace}/${project}/pulls`, options)
      if (!response.ok) throw new Error(`Server responded with status ${response.status}`)

      const projectData = await response.json()

      const allChanges = projectData.map(async pr => {
        const response = await fetch(pr.url, options)
        const { additions, deletions, number } = await response.json()
        return {
          added: additions,
          removed: deletions,
          id: number,
        }
      })

      return Promise.all(allChanges)
    }
    catch (e) {
      console.error('Failed to fetch data for LazyReviewer:', err)
    }
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

  get authToken() {
    return `token ${this.privateKey}`
  }

  get authHeader() {
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
      return GitLabService
    case 'github':
      return GitHubService
  }
}

// Simple node building
function el(strings, ...values) {
  const html = strings.reduce((html, str, i) => {
    html += values[i] ? `${str + values[i]}` : str;
    return html
  }, '')
  return document.createRange().createContextualFragment(html)
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
      const Service = getService(service)
      new Service(url, key)
    })
  })
})
