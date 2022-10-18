import { CameraButton, ControlBar, EndCallButton, MicrophoneButton, useCall, useCallAgent, useCallClient, usePropsFor, VideoGallery } from "@azure/communication-react"
import { Stack } from "@fluentui/react";


export const CallingComponents = (): JSX.Element => {
    const call = useCall();
    const callAgent = useCallAgent();
    const callClient = useCallClient();

    const videoGalleryProps = usePropsFor(VideoGallery);
    const endCallProps = usePropsFor(EndCallButton);
    const cameraButtonProps = usePropsFor(CameraButton);
    const microphoneButtonProps = usePropsFor(MicrophoneButton);

    return(
        <>
            <Stack style={{width: '100vh', height: '100vh'}}>
                {videoGalleryProps && (<VideoGallery {...videoGalleryProps}/>)}
            </Stack>
            <Stack>
                <ControlBar>
                    {microphoneButtonProps && (<MicrophoneButton {...microphoneButtonProps}/>)}
                    {cameraButtonProps && (<CameraButton {...cameraButtonProps}/>)}
                    {endCallProps && (<EndCallButton {...endCallProps}/>)}
                </ControlBar>
            </Stack>
        </>
    )
}