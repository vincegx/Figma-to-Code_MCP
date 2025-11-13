import React from 'react';
import './Titlesection.css';
import imgGroup1000001422 from "./img/group-1000001422.svg";

export default function Titlesection() {
  return <div className="content-stretch flex items-center justify-between relative shrink-0 w-full" data-name="title section">
          <div className="content-stretch flex flex-col gap-custom-5 items-start leading-none not-italic relative shrink-0" data-name="Welcom">
            <p className="font-normal min-w-full relative shrink-0 text-lg text-dark w-[min-content] font-inter-400">
              Welcome back,
            </p>
            <p className="font-bold relative shrink-0 text-[39.285px] text-darker font-inter-700">
              Chandler Bing
            </p>
          </div>
          <div className="content-stretch flex gap-2 items-center relative shrink-0 w-custom-372" data-name="Buttons Set">
            <div className="basis-0 border border-accent border-solid box-border content-stretch flex gap-custom-10 grow items-center justify-center min-h-px min-w-px px-custom-18 py-4 relative rounded shrink-0 w-full" data-name="Request Payment">
              <p className="font-normal leading-none not-italic relative shrink-0 text-base text-dark font-inter-400">
                Request Payment
              </p>
            </div>
            <div className="basis-0 box-border content-stretch flex gap-custom-10 grow items-center justify-center min-h-px min-w-px px-custom-18 py-4 relative rounded shrink-0 w-full" data-name="Send Money">
              <p className="font-normal leading-none not-italic relative shrink-0 text-base text-dark font-inter-400">
                Send Money
              </p>
              <div className="h-custom-8dot904 relative shrink-0 w-custom-11dot47">
                <div className="absolute pos-custom-neg-5dot62pct-4dot36pct">
                  <img alt="" className="block max-w-none size-full" src={imgGroup1000001422} />
                </div>
              </div>
            </div>
          </div>
        </div>;
}
