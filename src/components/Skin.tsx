import { Panel, useReactFlow } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Save, Monitor, MousePointer2 } from 'lucide-react';

interface SkinProps {
    mouth: {
        spit: () => void;
    };
    eyes: {
        focus: () => void;
    };
}

export const Skin = ({ mouth, eyes }: SkinProps) => {
    return (
        <>
            {/* Top Right: Actions */}
            <Panel position="top-right" className="flex gap-2">
                <Button onClick={mouth.spit} variant="outline" size="sm" className="bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700">
                    <Save className="w-4 h-4 mr-2" />
                    Export
                </Button>
            </Panel>

            {/* Bottom Left: Controls & Hints */}
            <Panel position="bottom-left" className="flex gap-2 text-xs text-zinc-500">
                <TooltipProvider>
                    <div className="flex items-center gap-4 bg-zinc-900/50 p-2 rounded-lg backdrop-blur-sm border border-zinc-800">
                        <div className="flex items-center gap-1">
                            <MousePointer2 className="w-3 h-3" />
                            <span>Selection Box: Hold Shift</span>
                        </div>
                        <div className="w-px h-3 bg-zinc-700" />

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 hover:bg-zinc-800 rounded-full"
                                    onClick={() => eyes.focus()}
                                >
                                    <Monitor className="w-3 h-3" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Fit View (.)</TooltipContent>
                        </Tooltip>
                    </div>
                </TooltipProvider>
            </Panel>
        </>
    );
};
