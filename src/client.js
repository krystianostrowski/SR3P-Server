class Client 
{
    constructor(id, type, socket, status)
    {
        this.id = id;
        this.type = type;
        this.socket = socket;
        this.status = status;
    };

    UpdateStatus = status => {
        this.status = status;
    };
}

const ClientTypes = {
    DISPATCHER: 'dispatcher',
    FIREFIGHTERS: 'ff',
    AMBULANCE: 'ambulance',
    POLICE: 'police'
};

const ClientStatus = {
    AVAILABLE: 'available',
    BUSY: 'busy'
};

module.exports = {
    Client: Client,
    ClientTypes: ClientTypes,
    ClientStatus: ClientStatus
};