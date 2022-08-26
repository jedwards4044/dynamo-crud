require('dotenv').config()
const AWS = require('aws-sdk')
AWS.config.update({
    region: process.env.CMS_DEFAULT_REGION,
    accessKeyId: process.env.CMS_ACCESS_KEY_ID,
    secretAccessKey: process.env.CMS_SECRET_ACCESS_KEY_ID,
})

const s3 = new AWS.S3()

const transformCMSData = function (data) {
    let newData = []
    const pageListData = []
    for (const [key, value] of Object.entries(data.pages)) {
        //creating file for pagelist
        pageListData.push(createPageList(value))

        //transforming page data
        if (value.backup.data) {
            const columnsData = []
            for (let i = 0; i <= 4; ++i) {
                columnsData.push(transformCMSPage(value.backup.data.modules[i]))
            }

            value.backup.data.modules = columnsData
        }

        newData.push(value)
    }

    const pageList = { pages: pageListData }
    data.pages = newData

    //returned transformed whole page json and pagelist
    return { data: data, pageList: pageList }
}

const transformCMSPage = (pageData) => {
    let newData = []

    for (const [key, value] of Object.entries(pageData)) {
        let modType

        if (value.type === 'article_1' || value.type === 'article_2' || value.type === 'article_3' || value.type === 'article') {
            modType = 'MyArticle'
        }

        const modData = { ...value, modId: key }

        const newItem = { attributes: modData, componentType: modType }
        newData.push(newItem)
    }
    return newData
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
const addFilesS3 = async (data, pageList) => {
    const pages = data.pages

    //adding page list file to s3
    addPageListS3(pageList, data)

    //adding page files to s3
    addPagesS3(data.pages, data)

    //add full site data to s3
    addSiteDataS3(data)
}

const addPageListS3 = async (pageList, data) => {
    await s3
        .putObject({
            Body: JSON.stringify(pageList),
            Bucket: 'townsquareinteractive',
            Key: `${data.config.website.url}/pages/page-list.json`,
        })
        .promise()

    console.log('Pagelist Placed')
}

const addPagesS3 = async (pages, data) => {
    for (let i = 0; i < pages.length; i++) {
        await s3
            .putObject({
                Body: JSON.stringify(pages[i]),
                Bucket: 'townsquareinteractive',
                Key: `${data.config.website.url}/pages/${pages[i].slug}.json`,
            })
            .promise()

        console.log('Page Placed')
    }
}

const addSiteDataS3 = async (data) => {
    await s3
        .putObject({
            Body: JSON.stringify(data),
            Bucket: 'townsquareinteractive',
            Key: `${data.config.website.url}/siteData.json`,
        })
        .promise()
}

module.exports = {
    addFilesS3,
    transformCMSData,
}