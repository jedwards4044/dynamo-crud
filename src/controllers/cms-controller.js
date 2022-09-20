require('dotenv').config()
const AWS = require('aws-sdk')
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3')
/* const { getObjectCommand, S3Client } = require('aws-sdk') */

AWS.config.update({
    region: process.env.CMS_DEFAULT_REGION,
    accessKeyId: process.env.CMS_ACCESS_KEY_ID,
    secretAccessKey: process.env.CMS_SECRET_ACCESS_KEY_ID,
    //logger: console,
})

const s3 = new AWS.S3()

const transformPagesData = function (pageData, siteData) {
    console.log('page transformer started')
    let newData = []
    //const pageListData = []
    for (const [key, value] of Object.entries(pageData)) {
        if (value.data.title) {
            console.log('name found', value.data.title)
            delete value.data.title
        }

        //getting data from site
        const pageId = key
        const pageTitle = siteData[pageId].title
        const pageSlug = siteData[pageId].slug
        const page_type = siteData[pageId].page_type

        //adding site data to pages
        value.data = { id: pageId, title: pageTitle, slug: pageSlug, page_type: page_type, ...value.data }

        //transforming page data
        if (value.data.modules) {
            value.data.modules = transformCMSMods(value.data.modules)
            newData.push(value)
        }
    }

    pageData.pages = newData

    //returned transformed whole page json and pagelist
    return pageData
}

const transformCMSMods = (pageData) => {
    let columnsData = []
    for (let i = 0; i <= pageData.length; ++i) {
        if (pageData[i]) {
            let newData = []

            for (const [key, value] of Object.entries(pageData[i])) {
                let modType

                if (value.type === 'article_1' || value.type === 'article_2' || value.type === 'article_3' || value.type === 'article') {
                    modType = 'MyArticle'
                }

                const modData = { ...value, modId: key }

                const newItem = { attributes: modData, componentType: modType }
                newData.push(newItem)
            }
            columnsData.push(newData)
        }
    }
    return columnsData
}

const createPageList = (value) => {
    const pageData = {
        name: value.title,
        slug: value.slug,
        id: value.id,
        page_type: value.page_type,
    }

    return pageData
}

//adding a page file for each page in cms data
const addMultipleS3 = async (data, pageList, newUrl) => {
    const pages = data.pages

    //adding page list file to s3
    addFileS3(pageList, `${newUrl}/pages/page-list.json`)

    //adding page files to s3
    for (let i = 0; i < data.pages.length; i++) {
        addFileS3(data.pages[i], `${newUrl}/pages/${pages[i].slug}.json`)
    }

    //add full site data to s3
    addFileS3(data, `${newUrl}/siteData.json`)
}

const stripUrl = (url) => {
    const removeProtocol = url.replace(/(^\w+:|^)\/\//, '')
    return removeProtocol.replace(/\..*/, '')
}

const transformPageData = function (page) {
    if (page.publisher) {
        page.publisher.data.modules = transformCMSMods(page.publisher.data.modules)
    }
    if (page.backup) {
        page.backup.data.modules = transformCMSMods(page.backup.data.modules)
    }
    if (page.modules) {
        page.modules = transformCMSMods(page.modules)
    }
    return page
}

const updatePageList = async (page, newUrl) => {
    console.log('page list updater started ------')
    const pageListUrl = `${newUrl}/pages/page-list.json`

    //let pageList = await getFile()

    //check to see if pagelist exists
    /* let isPage
    await s3.headObject({ Bucket: 'townsquareinteractive', Key: pageListUrl }, function (err, metadata) {
        if (err && err.name === 'NotFound') {
            // Handle no object on cloud here
            pageListFile = { pages: [] }
            addPagesToList()
            addFileS3List(pageListFile, pageListUrl) 
            // pageChanges(false)
            console.log('pagelist not found')
            isPage = false
            return false
        } else if (err) {
            // Handle other errors here....
            //pageChanges(false)
            console.log(err.name)
            isPage = false
            return false
        } else {
            // Do stuff with signedUrl
            // pageChanges(true)
            addPagesToList()
            addFileS3List(pageListFile, pageListUrl) 
            console.log('pageList found')
            isPage = true

            return true
        }
    })
 */
    //add page object to pagelist
    const addPagesToList = (pageListFile) => {
        console.log('old pagelist', pageListFile)
        for (let i = 0; i < page.length; i++) {
            pageData = page[i].data
            if (pageListFile.pages.filter((e) => e.name === pageData.title).length === 0) {
                pageListFile.pages.push({
                    name: pageData.title,
                    slug: pageData.slug,
                    id: pageData.id,
                    page_type: pageData.page_type,
                })
                console.log('new page added:', pageData.title)
            } else {
                console.log('page already there', pageData.title)
            }
        }
    }

    async function getFile() {
        try {
            const data = await s3.getObject({ Bucket: 'townsquareinteractive', Key: `${newUrl}/pages/page-list.json` }).promise()
            console.log('getFile', data)

            return JSON.parse(data.Body.toString('utf-8'))
        } catch (err) {
            console.log('pagelist not found in S3, creating new pageList')
            /* return {
                statusCode: err.statusCode || 400,
                body: err.message || JSON.stringify(err.message),
            } */

            return { pages: [] }
        }
    }

    let pageListFile = await getFile()
    addPagesToList(pageListFile)
    await addFileS3List(pageListFile, pageListUrl)

    /*     if (isPage) {
        let pageListFile = await getFile()
        addPagesToList(pageListFile)
        await addFileS3List(pageListFile, pageListUrl)
    } else {
        let pageListFile = { pages: [] }
        addPagesToList(pageListFile)
        await addFileS3List(pageListFile, pageListUrl)
    }
 */
    /* async function pageChanges(isPageList) {
        console.log('page changer started')
        if (await isPageList) {
            let pageListFile = await getFile()
            addPagesToList(pageListFile)
            await addFileS3List(pageListFile, pageListUrl)
        } else {
            let pageListFile = { pages: [] }
            addPagesToList(pageListFile)
            await addFileS3List(pageListFile, pageListUrl)
        }
    } */
}

const transformCMSData = function (data) {
    let newData = []
    const pageListData = []
    for (const [key, value] of Object.entries(data.pages)) {
        //creating file for pagelist
        pageListData.push(createPageList(value))

        //transforming page data
        if (value.publisher.data.modules) {
            value.publisher.data.modules = transformCMSMods(value.publisher.data.modules)
            newData.push(value)
        } else if (value.backup.data) {
            value.backup.data.modules = transformCMSMods(value.backup.data.modules)
            newData.push(value)
        } else {
            newData.push(value)
        }
    }

    const pageList = { pages: pageListData }
    data.pages = newData

    //returned transformed whole page json and pagelist
    return { data: data, pageList: pageList }
}

//add any file, pass it the file and key for filename
const addFileS3 = async (file, key) => {
    console.log('starting file upload')
    await s3
        .putObject({
            Body: JSON.stringify(file),
            Bucket: 'townsquareinteractive',
            Key: key,
        })
        .promise()
        .catch((error) => {
            console.error(error)
        })

    console.log('File Placed')
}

const addFileS3List = async (file, key) => {
    console.log('pagelist to be added', file)

    await s3
        .putObject({
            Body: JSON.stringify(file),
            Bucket: 'townsquareinteractive',
            Key: key,
        })
        .promise()

    console.log('pagelist Placed')
}

module.exports = {
    addMultipleS3,
    transformCMSData,
    transformPageData,
    updatePageList,
    addFileS3,
    stripUrl,
    transformPagesData,
}
