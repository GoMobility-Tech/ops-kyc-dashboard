import React from 'react';
import DriverWorkspace from '../../components/driver/DriverWorkspace.jsx';
import { getMyDriverDetail } from '../../api/opsApi.js';

export default function WorkspacePage() {
  return <DriverWorkspace fetchDetail={getMyDriverDetail} backTo="/my-drivers" />;
}
