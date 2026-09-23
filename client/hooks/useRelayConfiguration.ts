'use client';

import { useState } from 'react';

export function useRelayConfiguration() {
    const [relayEnabled, setRelayEnabled] = useState(true);
    return { relayEnabled, setRelayEnabled };
}
