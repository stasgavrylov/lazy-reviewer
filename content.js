const PRIVATE_TOKEN = '7-k3Pak8M6UJuayNrx3i'

function init(url) {
  const { pathname, searchParams } = new URL(url)
  const [ page, projectName, ...rest ] = pathname.split('/').filter(e => e).reverse()

  // const $sortingMenu = $('.issues-filters .dropdown-menu-sort')
  // const $sortingList = $sortingMenu.firstElementChild
  // const $sortingButton = $sortingMenu.previousElementSibling


  // const $link = document.createElement('a')
  // $link.textContent = 'Less lines'
  // $link.href = '#'

  // $link.addEventListener('click', (e) => {
  //   e.preventDefault()
  //   $sortingButton.childNodes[2].textContent = $link.textContent
  // })

  // $sortingList.prepend($link)
  // $sortingList.addEventListener('click', insertLinks)


  const headers = new Headers()
        headers.append('PRIVATE-TOKEN', PRIVATE_TOKEN)
  const options = {
    method: 'GET',
    mode: 'cors',
    cache: 'default',
    headers,
  }

  fetch('https://gitlab.railsreactor.com/api/v3/projects/', options)
    .then(data => data.json())
    .then(projects => {
      const projectId = projects.find(proj => proj.name == projectName).id
      fetch(
        `https://gitlab.railsreactor.com/api/v3/projects/${projectId}/merge_requests?state=opened`,
        options
      )
      .then(data => data.json())
      .then(json => {
        const allChanges = json.map(({ id, iid }) => fetch(
          `https://gitlab.railsreactor.com/api/v3/projects/${projectId}/merge_requests/${id}/changes`,
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
              const $mergeLink = $(`a[href$="/${id}"]`)
              $mergeLink.append(buildDiffMarkup(added, removed))
          })
        })
      })
    })
    .catch(err => { console.error('Failed to fetch projects list:', err) })
}



/*
 * Utils
 */

var $ = document.querySelector.bind(document)

// Simple node building
function create(tag, content, className) {
  const $el = document.createElement(tag)
  $el.textContent = content
  $el.className = className
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

  const $c = create('span', '', 'mrs-changes')
  const $added = create('span', `+${added}`, 'mrs-gitlab-added')
  const $removed = create('span', `-${removed}`, 'mrs-gitlab-removed')

  $c.append($added, $removed)
  $f.append($c)
  return $f
}

// Calculate number of added and removed lines
function occurrences(string, subString) {
  var n = 0, pos = 0, step = subString.length;

  while (true) {
    pos = string.indexOf(subString, pos);
    if (pos >= 0) {
        ++n;
        pos += step;
    }
    else break;
  }
  return n;
}

/*
 * Initialization
 */

chrome.runtime.onMessage.addListener(function({ url }, sender) {
  init(url);
});
