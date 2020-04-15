const axios = require('axios')
const CLIEngine = require('eslint').CLIEngine
var fs = require('fs')
var path = require('path')
const packages = require('./package.json')
let outP = path.resolve(__dirname, packages.mockConfig.output)
let PromiseArr = []
let page = packages.mockConfig.page
packages.mockConfig.swaggerList.forEach(item => {
  let getApi = new Promise((resolve, reject) => {
    axios.get(`${item}/v2/api-docs`).then(data => {
      let respnseData = data.data
      let rex = /\{(.+?)\}/g
      let org = Object.keys(respnseData.paths).map(item => {
        let method = Object.keys(respnseData.paths[item])[0]
        let url = item.replace(rex, '[_a-zA-Z0-9]+')
        let request = {}
        let response = {}
        respnseData.paths[item][method].parameters.forEach(item => {
          if (item.in === 'query') {
            request[item.required ? (item.name + '@required') : item.name] = ''
          } else if (item.in === 'body') {
            if (item.schema) {
              let df = item.schema.$ref.split('/').pop()
              let pop = respnseData.definitions[df].properties
              for (let key in pop) {
                switch (pop[key].type) {
                  case 'object':
                    break
                  case 'array':
                    break
                  default:
                    request[pop[key]] = ''
                }
              }
            } else {
              request[item.required ? (item.name + '@required') : item.name] = ''
            }
          }
        })
        let respSchema = respnseData.paths[item][method].responses['200'].schema || ''
        if (respSchema && respSchema.$ref) {
          let resdf = respSchema.$ref.split('/').pop()
          let pop = respnseData.definitions[resdf].properties
          enumResponse(respnseData, response, pop)
        }
        return {
          method: method,
          url: 'mock-s' + url,
          name: respnseData.paths[item][method].summary,
          request,
          response
        }
      })
      if (!fs.existsSync(outP)) {
        fs.mkdirSync(outP, 777)
      }
      fs.writeFileSync(outP + `\\${respnseData.info.title}.js`, `;(function () {
      let repositoryId = '${String(respnseData.host)}';
       let interfaces =` + JSON.stringify(org).replace(/'/g, '"') + `;
       let RAP = window.RAP || { protocol: 'http',
       interfaces: {}
  }
  RAP.interfaces[repositoryId] = interfaces
  window.RAP = RAP
  })()`)

      var cli = new CLIEngine({
        envs: ['browser', 'mocha'],
        fix: true,
        useEslintrc: true,
        rules: {
          semi: 2
        }
      })
      console.log(`${respnseData.info.title}.js`, outP)
      var report = cli.executeOnFiles([`${respnseData.info.title}.js`, outP])
      // process.stdout.write(respnseData.info.title)
      CLIEngine.outputFixes(report)
      resolve(true)
    }).catch(err => {
      reject(err)
    })
  })
  PromiseArr.push(getApi)
})
Promise.all(PromiseArr).then(() => {
  process.stdout.write('成功！！')
}).catch(err => {
  console.log(err)
})
function enumResponse (respnseData, response, pop) {
  for (let key in pop) {
    switch (pop[key].type) {
      case 'object':
        if (pop[key].$ref) {
          let resdfChildOb = pop[key].$ref.split('/').pop()
          let popChildOb = respnseData.definitions[resdfChildOb].properties
          enumResponse(respnseData, response, popChildOb)
        }
        break
      case 'array':
        response[key + '|1-' + page] = [{}]
        if (pop[key].items.$ref) {
          let resdfChildAr = pop[key].items.$ref.split('/').pop()
          let popChildAr = respnseData.definitions[resdfChildAr].properties
          enumResponse(respnseData, response[key + '|1-20'][0], popChildAr)
        } else {
          // response[key + '|1-' + page] = [`/[1-9]{2}/`]
        }
        break
      case 'string':
        response[key] = '@title'
        break
      case 'integer':
        response[key + '|+1'] = 1
        break
      case 'boolen':
        response[key + '|1-2'] = true
        break
      default:
        if (pop[key].$ref) {
          let resdfChild = pop[key].$ref.split('/').pop()
          let popChild = respnseData.definitions[resdfChild].properties
          enumResponse(respnseData, response, popChild)
        }
    }
  }
}
