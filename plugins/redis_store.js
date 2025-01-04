const Redis = require('ioredis');
const fs = require("fs");
const path = require("path");
const { extensions } = require("./extensions");
require('dotenv').config();

let redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    lazyConnect: true
});

const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

exports.hook_data = function (next, connection) {
    connection.transaction.parse_body = true;
    next();
};

exports.hook_data_post = function (next, connection) {
    const transaction = connection.transaction;

    let emailBody = transaction.body

    //in case of logging
    // fs.writeFile("./emailBody.txt", JSON.stringify(emailBody), function (err) {})

    let headers = emailBody.header.headers;
    const subject = headers.subject.map(el => el.substring(0, el.length - 1));
    const from = headers.from.map(el => el.substring(0, el.length - 1));
    const to = headers.to.map(entry => {
        const match = entry.match(emailRegex);
        return match ? match[0] : null;
    }).filter(Boolean);

    const parsedEmail = iterateChildren(emailBody, connection)

    //in case of logging
    // fs.writeFile("./parsedEmail.txt", JSON.stringify(parsedEmail), function (err) {})

    const emailJson = {
        subject: subject,
        from: from,
        to: to,
        text: parsedEmail.body.text,
        attachments: parsedEmail.attachments
    };

    //in case of logging
    // if (parsedEmail.attachments.length > 0) temp(parsedEmail.attachments[0])

    const redisKey = `email:${to}:${Date.now()}`;
    redis.set(redisKey, JSON.stringify(emailJson), 'EX', process.env.TTL, (err) => {
        if (err) {
            connection.logerror(`Redis .set() failed: ${err.message}`);
        }
        connection.loginfo(`Email stored successfully`);
        next(OK)
    });
};

function iterateChildren(emailBody, connection) {
    const children = emailBody.children
    const parsedEmail = { body: {}, attachments: [] }

    if (children.length === 0) {
        parsedEmail.body.text = emailBody.bodytext
    }

    for (const child of children) {
        if (child.state === "body") {
            parsedEmail.body.text = child.bodytext;
        } else if (child.state === "attachment") {
            const contentTypeMatch = child.ct.match(/^([^;]+)/);
            const nameMatch = child.ct.match(/name="([^"]+)"/);
            const contentType = contentTypeMatch ? contentTypeMatch[1] : null;
            let fileName = nameMatch ? nameMatch[1] : null;
            const file = Buffer.from(child.buf);
            if (!path.extname(fileName)) fileName += extensions[contentType] || ".bin";

            //in case of logging
            // fs.writeFileSync("1" + fileName, file);

            const attachment = {
                filename: fileName,
                contentType: contentType,
                size: file.length,
                content: file.toString("base64")
            }

            //in case of logging
            // fs.writeFileSync("2.txt", file.toString("base64"));

            parsedEmail.attachments.push(attachment)
        }
    }

    return parsedEmail
}

function temp(attachment) {
    function saveBase64ToFile(base64Data, filePath) {
        const base64Content = base64Data.startsWith("data:")
            ? base64Data.split(",")[1]
            : base64Data;

        const fileBuffer = Buffer.from(base64Content, 'base64');

        fs.writeFileSync(filePath, fileBuffer);
        console.log(`File saved as ${filePath}`);
    }

    const fileName = "3" + attachment.filename;
    const base64String = attachment.content;

    saveBase64ToFile(base64String, fileName);
}
