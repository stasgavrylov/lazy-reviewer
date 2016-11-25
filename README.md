Lazy Reviewer
==========
> For those who don't like to review lots of code, or vice versa.

**Lazy Reviewer** is a Chrome extension that adds information on merge request diffs to "Merge Requests" section on GitLab (GitHub coming soon). It also allows you to sort all MRs by the amount of changes.

![](https://i.imgur.com/6G34p1V.gif)

Everyone knows that feeling when your colleague asks you to review his "tiny MR", but there's no way to find out it's actual size unless you're already reviewing it. Fortunately, this awesome extension eliminates the problem and allows you to prevent misinformation by displaying actual diff for every merge request in your project.

Those who are ready for the biggest challenges can alwayse use "More changes" sorting option to help their friends in need, of course.


Installation
-----

Since this extension is not yet published to Chrome Web Store, installation process is a bit cumbersome:

1. Clone the repo or download and unzip the file.
2. Open Chrome's Extensions or `chrome://extensions` tab
3. Enable the ***Developer mode*** checkbox
4. Click "Load unpacked extension..." and select the folder which you've saved the extension to.
5. Proceed to **Getting Started** section.


Getting Started
-----

To be able to request info on your project, you must provide an access token for GitLab API. It's not that hard to get one, but without it the extension won't work.
To set your access token, click on **Lazy Reviewer** extension icon on the toolbar and paste the token into corresponding input. By default, it will be used to access your projects hosted at `gitlab.com`. If you don't have an access token yet, clicking on `(get one)` link will redirect you to corresponding section in GitLab profile where you can easily create one. Enter any name, choose an expiration date and click ***Create Personal Access Token***. Then copy and paste your key to the extension popup.

![](http://i.imgur.com/tWFwmCW.gif)

**Be aware**: if your GitLab server is hosted on a custom domain, you should enter the domain's name in the first place, and only afterwards [click `(get one)` and] set your API key to avoid incorrect host mapping in extension settings.

![](http://i.imgur.com/u7I2ih8.gif)

**When the API key is set, you're good to go! Proceed to review those merge requests (the tiniest ones, of course).**


License
-----

[MIT](http://opensource.org/licenses/MIT)