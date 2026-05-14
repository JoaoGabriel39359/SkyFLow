import { v4 as uuidv4 } from 'uuid';

export const getDeviceId = () => {
    let id = localStorage.getItem('skyflow_device_id');
    if (!id) {
        // Se for a primeira vez abrindo o app, gera um ID único
        id = uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase();
        localStorage.setItem('skyflow_device_id', id);
    }
    return id;
};