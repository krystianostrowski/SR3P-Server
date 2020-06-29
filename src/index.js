const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const api = require('./modules/sr3pAPI');
const { DebugLog, LogTypes } = require('./modules/debug');
const { Port, Code, TryToSendReportThreshold } = require('./config.json');
const { Client, ClientTypes, ClientStatus } = require('./client');
const { RequestSendingReport } = require('./modules/report');
const helpers = require('./modules/helpers');
const e = require('express');

const clients = [];
const reportsQueue = [];

const UpdateInfo = reportID => {
    const report = api.GetReportById(reportID);
    const services = report.services;
    const dispatcherID = report.dispatcherID;

    const dispatcher = clients.getClientByID(dispatcherID);

    if(dispatcher)
        dispatcher.socket.emit('update-info', reportID);

    for(service in services)
    {   
        console.log(services[service].ids);
        const ids = services[service].ids;

        for(id of ids)
        {
            const c = clients.getClientByID(id.id);

            if(c)
                c.socket.emit('update-info', reportID);
        }
    }
};

DebugLog(`Starting server...`)
DebugLog(`Server is running on port: ${Port}`);
api.CheckIfDBExists();

io.on('connection', client => {
    DebugLog(`Client ${client.id} connected!`);

    client.on('register-client', id => {
        let type = id.split('-')[0];
        let clientType;

        if(type == 'SP')
        {
            clientType = ClientTypes.FIREFIGHTERS;
        }
        else if(type == 'POL')
        {
            clientType = ClientTypes.POLICE;
        }
        else if(type == 'PG')
        {
            clientType = ClientTypes.AMBULANCE;
        }
        else
        {
            clientType = ClientTypes.DISPATCHER;
        }

        const c = new Client(id, clientType, client, ClientStatus.AVAILABLE);
        clients.push(c);

        DebugLog(`Registered: ${c.id}, type ${c.type}`);

        //TODO: Check if there is any report in queue that client can be assigned to
    });

    // let i = 0;
    // setInterval(function() {
    //     console.log(i);
    //     i++;

    //     if(i == 10)
    //         clearInterval(this);

    // }, 500);

    //clients.removeClient(1);

    client.on('disconnect', () => {
        DebugLog(`Client ${client.id} disconnected`, LogTypes.WARN);
        clients.removeClientByConnectionID(client.id);
    }); 

    client.on('add-report', arg => {
        const { data, services, additionalInfo } = arg.report;
        const dispatcherID = arg.ID;
        const report = api.AddReport(data, services, additionalInfo, dispatcherID);

        client.emit('added-report', report);

        const res = RequestSendingReport(report.id, clients);

        if(!res.ffValidation || !res.policeValidation || !res.ambulanceValidation)
        {
            reportsQueue.push(report);

            setInterval(function () {
                if(reportsQueue.length > 0)
                {
                    const res = RequestSendingReport(reportsQueue[0].id, clients);
        
                    if(res.ffValidation && res.policeValidation && res.ambulanceValidation)
                    {
                        reportsQueue.splice(0, 1);
                        console.log(reportsQueue);
                    }
                }
                else if(reportsQueue.length == 0)
                {
                    clearInterval(this);
                }
            }, 5000);
  
        }
        else if(res.ffValidation && res.policeValidation && res.ambulanceValidation)
        {
            //const c = clients.getClientByID(report.dispatcherID);
            console.log(report.services);
            //c.socket.emit('update-info', report.id);
            UpdateInfo(report.id);
        }
    });

    // client.on('can-receive-report', () => {
    //     client.emit('sending-report', lastReport);
    // });

    client.on('getMapDir', arg => {
        const dir = api.GetMapDir(arg);

        const data = { report: arg, dir: dir }; 

        client.emit('got-map-dir', data);
    });

    client.on('get-route', arg => {
        const dir = api.GetMapDir(arg);

        const data = { report: arg, dir: dir }; 

        client.emit('got-route', data);
    });

    client.on('update-service-status', arg => {
        const reportID = arg.reportID;
        const serviceID = arg.serviceID;
        const status = arg.status;

        const serviceType = clients.getClientByID(serviceID).type;

        const dispatcherID = api.UpdateStatus(reportID, serviceID, serviceType, status);

        /*const c = clients.getClientByID(dispatcherID);
        c.socket.emit('update-info', reportID); */

        //UpdateInfo(reportID);

        if(status == "zakończono")
        {
            const c = clients.getClientByID(serviceID);
            c.UpdateStatus(ClientStatus.AVAILABLE);
        }

        UpdateInfo(reportID);
    });

    client.on('can-be-updated', id => {
        UpdateInfo(id);
    });
});

//#region express

app.get('/api/getReports', (req, res) => {
    const reports = api.GetArrayOfReports();

    res.send(reports);
});

app.get('/api/getBuildingInfo/:adress', (req, res) => {
    const building = api.GetBuildingInfo(req.params.adress);

    res.send(building);
});

app.get('/api/getReport/:adress', (req, res) => {
    const report = api.GetReport(req.params.adress);

    res.send(report);
});

app.get('/api/getCities', (req, res) => {
    const cities = api.GetArrayOfCities();

    res.send(cities);
});

app.get('/api/mapDir/:report', (req, res) => {
    const dir = api.GetMapDir(req.params.report);

    res.send(dir);
});

app.get('/api/connection', (req, res) => {
    res.send(true);
});

app.get('/api/getReportsArray/:address', (req, res) => {
    const array = api.GetReports(req.params.address);
    const path = '/Dream%20of%20You.mp3';

    /*const data = { reports: array, code: Code.hexEncode(), path: path.hexEncode() };

    res.send(data);*/
    res.send(array);
});

app.get('/api/GetReportByID/:id', (req, res) => {
    const report = api.GetReportById(req.params.id);

    res.send(report);
});

app.use(express.static('img'));

//#endregion

server.listen(Port);

String.prototype.hexEncode = function(){
    var hex, i;

    var result = "";
    for (i=0; i<this.length; i++) {
        hex = this.charCodeAt(i).toString(16);
        result += ("000"+hex).slice(-4);
    }

    return result
};