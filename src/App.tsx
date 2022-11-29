import { Call, CallAgent, CollectionUpdatedEvent, IncomingCall, IncomingCallEvent, LocalVideoStream } from '@azure/communication-calling';
import { AzureCommunicationTokenCredential, CommunicationUserIdentifier } from '@azure/communication-common';
import { CallAdapter, CallAdapterLocator, CallComposite, createAzureCommunicationCallAdapterFromClient, createStatefulCallClient, DeclarativeCallAgent, StatefulCallClient } from '@azure/communication-react';
import { initializeIcons, PrimaryButton, Stack, Text } from '@fluentui/react';
import { useEffect, useMemo, useState } from 'react';
import './App.css';
import { IncomingCallToast } from './Components/IncomingCallToast';

export function App() {

  initializeIcons();
  const token1: string = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjEwNiIsIng1dCI6Im9QMWFxQnlfR3hZU3pSaXhuQ25zdE5PU2p2cyIsInR5cCI6IkpXVCJ9.eyJza3lwZWlkIjoiYWNzOmRkOTc1M2MwLTZlNjItNGY3NC1hYjBmLWM5NGY5NzIzYjRlYl8wMDAwMDAxNS01ZmY4LWQ3YzMtZTE2Ny01NjNhMGQwMGQxNjkiLCJzY3AiOjE3OTIsImNzaSI6IjE2Njk2NzAwNTYiLCJleHAiOjE2Njk3NTY0NTYsImFjc1Njb3BlIjoidm9pcCIsInJlc291cmNlSWQiOiJkZDk3NTNjMC02ZTYyLTRmNzQtYWIwZi1jOTRmOTcyM2I0ZWIiLCJyZXNvdXJjZUxvY2F0aW9uIjoidW5pdGVkc3RhdGVzIiwiaWF0IjoxNjY5NjcwMDU2fQ.gnbBDS2aLFNLuHUoMygpotqHkm0ATp3vJGrxwGe2rgnohJIkR9k1o5FOx6FvksUMUBg3vCWAH3wWJt3XfUr9RefoDIgWgupEdmuGeZSqv66CONdN-ZjINwMYC5KMyYGDH-_BOba2QRdyh88Y3euTJaPQ-0u9UuBiY3HGHcCsq_koel9_PhvYCjn8ymeDgDV97fdaV-4hmxQbhjS9TwuEPwNEcku0WgIw4Pcige-J8SpyHL4A2tpA7BfkGI8toNhRSLdDT6ejO2YqIrAJntG3saUpQ1JPQjaOyZJRD9_FjaRuJdDlGbGJLpn_vvKa9zgJoOCUHfoSQv3DyC6kD7Jc9g';
  const userId: string = '8:acs:dd9753c0-6e62-4f74-ab0f-c94f9723b4eb_00000015-5ff8-d7c3-e167-563a0d00d169';

  const [statefulClient, setStatefulClient] = useState<StatefulCallClient>();
  // because we are creating the callAgent with the stateful client this should be the declaritive version
  const [callAgent, setCallAgent] = useState<DeclarativeCallAgent>();
  const [incomingCall, setIncomingCall] = useState<IncomingCall>();
  const [heldCalls, setHeldCalls] = useState<Call[]>([]);
  // how do we get this to map against the incoming calls in the call agent?
  /**
   * Something we need to look into here is how do we avoid Contoso doing this even at the stateful
   * layer?
   */
  const [incomingCalls, setIncomingCalls] = useState<readonly IncomingCall[]>([]);
  const [call, setCall] = useState<Call>();

  const [adapter, setAdapter] = useState<CallAdapter>();

  initializeIcons();

  const tokenToken = useMemo(() => {
    return new AzureCommunicationTokenCredential(token1);
  }, [token1]);

  useEffect(() => {
    if (!statefulClient) {
      setStatefulClient(
        createStatefulCallClient({
          userId: { communicationUserId: userId }
        })
      )
    }
  }, [statefulClient, userId]);

  // create call agent
  useEffect(() => {
    if (callAgent === undefined && statefulClient) {
      const agentTime = async (): Promise<void> => {
        setCallAgent(await statefulClient.createCallAgent(tokenToken, { displayName: 'whats happening?' }));
      }
      agentTime();
    }
  }, [callAgent, statefulClient, tokenToken]);

  useEffect(() => {
    if (callAgent !== undefined) {
      const incomingCallListener: IncomingCallEvent = ({ incomingCall }) => {
        setIncomingCall(incomingCall);
        setIncomingCalls(callAgent.incomingCalls);
      }
      const callUpdatedListener: CollectionUpdatedEvent<Call> = async (args: { added: Call[], removed: Call[] }) => {
        const createAdapter = async () => {
          if (statefulClient && callAgent && incomingCall) {
            const adapter = await createAzureCommunicationCallAdapterFromClient(
              statefulClient,
              callAgent,
              ({ participantIds: [(incomingCall.callerInfo.identifier as CommunicationUserIdentifier).communicationUserId] }) as CallAdapterLocator)
            adapter.on('callEnded', () => {
              console.log(adapter.getState().endedCall);
            });
            adapter.getState().page = 'call';
            setAdapter(adapter);
          }
        }
        createAdapter();
        setHeldCalls(callAgent.calls.filter((c) => c.state === 'LocalHold'));
      }
      
      callAgent.on('incomingCall', incomingCallListener);
      callAgent.on('callsUpdated', callUpdatedListener);
      return () => {
        callAgent.off('incomingCall', incomingCallListener);
      }
    }
  }, [callAgent, incomingCall, statefulClient]);

  const onRejectCall = (call: IncomingCall): void => {
    if (call) {
      call.reject();
    }
    setIncomingCall(undefined);
  };

  const onAcceptCall = async (incomingCall: IncomingCall): Promise<void> => {
    if (incomingCall && adapter) {
      const newCall = await incomingCall.accept();
      adapter.switchCall(newCall, call);
      // have adapter process new call
      setCall(newCall);
    } else if (incomingCall && statefulClient) {
      const deviceManager = (await statefulClient.getDeviceManager());
      const cameras = await deviceManager.getCameras();
      const localStream = new LocalVideoStream(cameras[0]);
      const call = await incomingCall.accept({ videoOptions: { localVideoStreams: [localStream] } });

      setCall(call);
    }
    setIncomingCall(undefined);
  };

  /**
   * This is a example of how Contoso might create the incoming Call notifications in thier app.
   * the incomingCalls referenced here can come from either the declaritiveCallAgent or the adapter.
   * 
   * TODO: how do we make sure that the adapter has access to the readOnly array from the declarativeCallAgent and 
   * not the array from the callContext?
   * 
   * note: this could be exported as its own component to allow the rendering of multiple toasts together, just pass
   * in an array of incomingCalls.
   * 
   * @returns Toast notifications for each incoming call
   */
  const renderIncomingCalls = (): JSX.Element => {
    const incomingCallToasts = incomingCalls.map((c) => (
      <IncomingCallToast
        incomingCall={c}
        callerName={c.callerInfo.displayName}
        onClickAccept={onAcceptCall}
        onClickReject={onRejectCall}
      />));
    return <Stack style={{ position: "absolute", bottom: "2rem", right: "2rem" }}>{incomingCallToasts}</Stack>
  }

  const renderHeldCalls = (): JSX.Element => {
    const heldCallToasts = heldCalls.map((c) => <Stack>
      <Text style={{fontWeight: 600, height:'1rem', padding: '0.25rem'}}>{c.id}</Text>
    </Stack >)
    return <Stack style={{ position: "absolute", bottom: "2rem", left: "2rem" }}>{heldCallToasts}</Stack>
}

if (statefulClient && callAgent && call && adapter) {
  return (
    <Stack className="App" style={{ height: '80%', margin: 'auto' }}>
      <Stack style={{ height: '80vh' }}>
        <CallComposite adapter={adapter} />
      </Stack>
      {renderIncomingCalls()}
      {renderHeldCalls()}
    </Stack>
  );
}

return (
  <Stack styles={{ root: { margin: 'auto', height: '36rem' } }}>
    <Text>your userId: {userId}</Text>
    {incomingCall && (<Text>You have a call!</Text>)}
    {renderIncomingCalls()}
    {renderHeldCalls()}
  </Stack>
)
}


export default App;
