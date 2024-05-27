import * as contentful from 'contentful';

const getContentfulClient = async (data: any) => {
    const spaceId = data.spaceId;
    const accesstoken = data.accessToken;

    const client = contentful.createClient({
        space: spaceId,
        accessToken: accesstoken,
    });

    return client;
}

const getContents = async (data: any) => {
    const getClientData = {
        spaceId: data.spaceId,
        accessToken: data.accessToken
    };

    const client = await getContentfulClient(getClientData);

    // type ContentOverviewSkeleton = {
    //     fields: { internalName: contentful.EntryFieldTypes.Text }
    //     contentTypeId: 'pageBlogPost'
    // };

    const contents = await client.getEntries({
        skip: 0,
        limit: 5,
        content_type: 'pageBlogPost',
        select: ["fields", "sys.id"]
    });

    const items = [];

    for (let i = 0; i < contents.items.length; i++) {
        const item = contents.items[i];

        if (item.fields) {
            let data: any = {
                internalName: item.fields.internalName,
                slug: item.fields.slug,
                auther: item.fields.auther,
                title: item.fields.title,
                shortDescription: item.fields.shortDescription,
                publishedDate: item.fields.publishedDate,
                featuredImage: item.fields.featuredImage     
            }

            const obj = {
                id: item.sys.id,
                fields: data
            };

            items.push(obj);
        }
    }

    const responseData = {
        total: contents.total,
        skip: contents.skip,
        limit: contents.limit,
        items: items
    }

    return responseData;
};

export let ContentfulApi = {
    getContents: getContents
};

