import axios from 'axios'
import nprogress from 'nprogress'

export default {
  resolveComponent: null,
  cancelToken: null,
  progressBar: null,
  firstPage: null,
  modal: null,
  page: {
    component: null,
    props: null,
    instance: null,
  },

  init(component, props, resolveComponent) {
    this.resolveComponent = resolveComponent

    if (window.history.state && this.navigationType() === 'back_forward') {
      this.setPage(window.history.state.component, window.history.state.props)
    } else {
      this.setPage(component, props)
      this.setState(true, window.location.pathname + window.location.search, {
        component: component,
        props: props,
      })
    }

    window.addEventListener('popstate', this.restore.bind(this))
    document.addEventListener('keydown', this.hideModalOnEscape.bind(this))
  },

  navigationType() {
    if (window.performance) {
      return window.performance.getEntriesByType('navigation')[0].type
    }
  },

  getHttp() {
    if (this.cancelToken) {
      this.cancelToken.cancel(this.cancelToken)
    }

    this.cancelToken = axios.CancelToken.source()

    return axios.create({
      cancelToken: this.cancelToken.token,
      headers: {
        'Accept': 'text/html, application/xhtml+xml',
        'X-Requested-With': 'XMLHttpRequest',
        'X-Inertia': true,
      },
    })
  },

  isInertiaResponse(response) {
    return response && response.headers['x-inertia']
  },

  showProgressBar() {
    this.progressBar = setTimeout(() => nprogress.start(), 250)
  },

  hideProgressBar() {
    nprogress.done()
    clearInterval(this.progressBar)
  },

  load(url, method, data = {}) {
    this.hideModal()
    this.showProgressBar()

    if (method === 'get') {
      var request = this.getHttp().get(url)
    } else if (method === 'post') {
      var request = this.getHttp().post(url, data)
    }

    return request.then(response => {
      if (this.isInertiaResponse(response)) {
        return response.data
      } else {
        this.showModal(response.data)
      }
    }).catch(error => {
      if (axios.isCancel(error)) {
        return
      } else if (this.isInertiaResponse(error.response)) {
        return error.response.data
      } else if (error.response) {
        this.showModal(error.response.data)
      } else {
        return Promise.reject(error)
      }
    }).then(page => {
      this.hideProgressBar()
      return page
    })
  },

  setPage(component, props) {
    return Promise.resolve(this.resolveComponent(component)).then(instance => {
      this.firstPage = this.firstPage === null
      this.page.component = component
      this.page.props = props
      this.page.instance = instance
    })
  },

  setState(replace = false, url, data = {}) {
    window.history[replace ? 'replaceState' : 'pushState'](data, '', url)
  },

  setScroll(preserveScroll) {
    if (!preserveScroll) {
      window.scrollTo(0, 0)
    }
  },

  first() {
    return this.firstPage
  },

  visit(url, { replace = false, preserveScroll = false } = {}) {
    return this.load(url, 'get').then(page => {
      if (page) {
        this.setState(replace, page.url, {
          component: page.component,
          props: page.props,
        })
        this.setPage(page.component, page.props)
          .then(() => this.setScroll(preserveScroll))
      }
    })
  },

  post(url, data = {}, { preserveScroll = false } = {}) {
    return this.load(url, 'post', data).then(page => {
      if (page) {
        this.setState(page.url === window.location.pathname + window.location.search, page.url, {
          component: page.component,
          props: page.props,
        })
        this.setPage(page.component, page.props)
          .then(() => this.setScroll(preserveScroll))
      }
    })
  },

  replace(url, { preserveScroll = false } = {}) {
    return this.visit(url, { replace: true, preserveScroll })
  },

  restore(event) {
    if (event.state) {
      this.setPage(event.state.component, event.state.props)
    }
  },

  cache(key, props) {
    this.setState(true, window.location.pathname + window.location.search, {
      component: this.page.component,
      props: { ...this.page.props, [key]: props },
    })
  },

  showModal(html) {
    let page = document.createElement('html')
    page.innerHTML = html
    page.querySelectorAll('a').forEach(a => a.setAttribute('target', '_top'))

    this.modal = document.createElement('div')
    this.modal.style.position = 'fixed'
    this.modal.style.width = '100vw'
    this.modal.style.height = '100vh'
    this.modal.style.padding = '50px'
    this.modal.style.backgroundColor = 'rgba(0, 0, 0, .6)'
    this.modal.style.zIndex = 200000
    this.modal.addEventListener('click', () => this.hideModal())

    let iframe = document.createElement('iframe')
    iframe.style.backgroundColor = 'white'
    iframe.style.borderRadius = '5px'
    iframe.style.width = '100%'
    iframe.style.height = '100%'
    this.modal.appendChild(iframe)

    document.body.prepend(this.modal)
    document.body.style.overflow = 'hidden'
    iframe.contentWindow.document.open()
    iframe.contentWindow.document.write(page.outerHTML)
    iframe.contentWindow.document.close()
  },

  hideModal() {
    if (this.modal) {
      this.modal.outerHTML = ''
      this.modal = null
      document.body.style.overflow = 'visible'
    }
  },

  hideModalOnEscape(event) {
    if (this.modal && event.keyCode == 27) {
      this.hideModal()
    }
  },
}
